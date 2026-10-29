import express from "express";

const app = express();

app.use(express.json())

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "welcome server is open",
  });
});

export default app;
