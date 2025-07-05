import { RequestHandler, Router } from "express";
import { identifyHandler } from "./controllers/identifyController";

const router = Router();

router.post("/identify", identifyHandler);

export default router;