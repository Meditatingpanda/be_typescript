import { NextFunction, Request, Response } from "express";

interface CustomError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err.stack);

  const statusCode =
    process.env.NODE_ENV === "production" ? err.statusCode : 500;
  const message =
    process.env.NODE_ENV === "production"
      ? err.message
      : "Internal Server Error";

  res.status(statusCode || 500).json({
    error: {
      message,
      status: statusCode,
    },
  });
};