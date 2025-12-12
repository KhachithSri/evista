import express from "express";

const router = express.Router();

// Placeholder Vimeo route to prevent server startup failures.
// Implement actual Vimeo integration when API credentials/workflow are ready.
router.get("/", (req, res) => {
  return res.status(501).json({
    error: "Vimeo API integration not implemented",
    message: "This endpoint is a placeholder."
  });
});

export default router;
