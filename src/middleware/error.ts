import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
    public readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

export function notFound(req: Request, _res: Response, next: NextFunction) {
    next(new HttpError(404, `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server';

    if (status >= 500) {
        console.error(err);
    }

    return res.status(status).json({
        status: false,
        message,
    });
}
