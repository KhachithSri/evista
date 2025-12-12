import express from "express";

const router = express.Router();

// Placeholder Translate route to prevent server startup failures.
// Implement actual translation integration when ready.
router.post("/", (req, res) => {
  return res.status(501).json({
    error: "Translation API integration not implemented",
    message: "This endpoint is a placeholder."
  });
});

export default router;
