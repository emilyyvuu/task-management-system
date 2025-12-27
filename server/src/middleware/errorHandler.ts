import { NextFunction, Request, Response } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  const status = Number(err?.statusCode ?? 500);

  return res.status(status).json({
    error: status === 500 ? "Internal server error" : String(err?.message ?? "Error"),
  });
}
