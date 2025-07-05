import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

interface ContactResponse {
  primaryContactId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export const identifyHandler = async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Validate input
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ error: "Email or phoneNumber is required" });
    }

    const result = await identifyContact(email, phoneNumber);
    return res.json({ contact: result });
  } catch (error) {
    console.error("Error in identify handler:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const identifyContact = async (
  email?: string,
  phoneNumber?: string
): Promise<ContactResponse> => {
  // Find contacts that match either email or phone
  const relatedContacts = await prisma.contact.findMany({
    where: {
      OR: [{ email: email || null }, { phoneNumber: phoneNumber || null }],
      deletedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // If no contacts found, create a new primary contact
  if (relatedContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: "primary",
      },
    });

    return {
      primaryContactId: newContact.id,
      emails: email ? [email] : [],
      phoneNumbers: phoneNumber ? [phoneNumber] : [],
      secondaryContactIds: [],
    };
  }

  // Get all related contacts (including linked ones)
  const contactIds = relatedContacts.map((c) => c.id);
  const linkedContactIds = relatedContacts
    .filter((c) => c.linkedId !== null)
    .map((c) => c.linkedId as number);

  const allContactIds = [...new Set([...contactIds, ...linkedContactIds])];

  const allRelatedContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: { in: allContactIds } }, { linkedId: { in: allContactIds } }],
      deletedAt: null,
    },
  });

  // Find the primary contact
  const primaryContact = allRelatedContacts.find(
    (c) => c.linkPrecedence === "primary"
  );

  if (!primaryContact) {
    throw new Error("No primary contact found");
  }

  // Check if we need to create a new secondary contact
  const existingEmailContact = allRelatedContacts.find(
    (c) => c.email === email
  );
  const existingPhoneContact = allRelatedContacts.find(
    (c) => c.phoneNumber === phoneNumber
  );

  // If we have both email and phone, but they exist in separate contacts
  if (
    email &&
    phoneNumber &&
    existingEmailContact &&
    existingPhoneContact &&
    existingEmailContact.id !== existingPhoneContact.id
  ) {
    // Create a new secondary contact if needed
    const shouldCreateNewContact = !allRelatedContacts.some(
      (c) => c.email === email && c.phoneNumber === phoneNumber
    );

    if (shouldCreateNewContact) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: "secondary",
        },
      });
    }
  }

  // Get the latest set of contacts after potential modifications
  const finalContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
      deletedAt: null,
    },
  });

  // Collect unique emails and phone numbers
  const emails = [
    ...new Set(finalContacts.map((c) => c.email).filter(Boolean) as string[]),
  ];

  const phoneNumbers = [
    ...new Set(
      finalContacts.map((c) => c.phoneNumber).filter(Boolean) as string[]
    ),
  ];

  // Get secondary contact IDs
  const secondaryContactIds = finalContacts
    .filter((c) => c.linkPrecedence === "secondary")
    .map((c) => c.id);

  return {
    primaryContactId: primaryContact.id,
    emails,
    phoneNumbers,
    secondaryContactIds,
  };
};
