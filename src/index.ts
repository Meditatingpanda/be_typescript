import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandlerMiddleware";
import dotenv from "dotenv";
import identifyRouter from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/v1", identifyRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
