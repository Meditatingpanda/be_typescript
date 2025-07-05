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

export const identifyHandler = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Validate input
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json({ error: "Email or phoneNumber is required" });
    }

    const result = await identifyContact(email, phoneNumber);
    res.json({ contact: result });
  } catch (error) {
    console.error("Error in identify handler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const identifyContact = async (
  email?: string | null,
  phoneNumber?: string | null
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

  // Find the primary contacts
  const primaryContacts = allRelatedContacts.filter(
    (c) => c.linkPrecedence === "primary"
  );

  if (primaryContacts.length === 0) {
    throw new Error("No primary contact found");
  }

  // If multiple primary contacts are found, we need to choose the oldest one
  // as the primary and convert others to secondary
  let primaryContact = primaryContacts[0];

  if (primaryContacts.length > 1) {
    // Sort by createdAt to find the oldest primary contact
    primaryContacts.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    primaryContact = primaryContacts[0];

    // Convert other primaries to secondary
    const otherPrimaries = primaryContacts.slice(1);

    for (const contact of otherPrimaries) {
      if (contact.id !== primaryContact.id) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkedId: primaryContact.id,
            linkPrecedence: "secondary",
          },
        });
      }
    }
  }

  // Check if we need to create a new secondary contact
  const existingEmailContact = allRelatedContacts.find(
    (c) => c.email === email
  );
  const existingPhoneContact = allRelatedContacts.find(
    (c) => c.phoneNumber === phoneNumber
  );

  // Create a secondary contact if we have new information
  if (email && phoneNumber) {
    // If email exists but phone doesn't match the email contact
    if (existingEmailContact && !existingPhoneContact) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: "secondary",
        },
      });
    }
    // If phone exists but email doesn't match the phone contact
    else if (existingPhoneContact && !existingEmailContact) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: "secondary",
        },
      });
    }
    // If both exist but are different contacts, we don't need to create a new one
    // as we've already linked them above if they were primaries
  }

  // Get the latest set of contacts after potential modifications
  const finalContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
      deletedAt: null,
    },
    orderBy: {
      createdAt: "asc", // To ensure primary contact's email/phone comes first
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
