import express from "express";
import type { Request, Response } from "express";

const app = express();
const PORT = 3000;

app.get("/", (req: Request, res: Response) => {
    res.send("Hello from Express + TypeScript + pnpm!");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});