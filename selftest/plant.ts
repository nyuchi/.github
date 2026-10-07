import express from "express";
const app = express();
app.get("/x", (req, res) => {
  res.send(eval(req.query.q as string));
});
