const express = require("express");
const router = express.Router();
const pool = require("../db");
const nodemailer = require("nodemailer");

// ✅ send-otp
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email required" });

  try {
    // generate otp
    const otp = Math.floor(100000 + Math.random() * 900000);

    // save to DB
    await pool.query(
      "INSERT INTO users (email, otp_code, otp_expiry) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE)) ON DUPLICATE KEY UPDATE otp_code=?, otp_expiry=DATE_ADD(NOW(), INTERVAL 5 MINUTE)",
      [email, otp, otp]
    );

    // send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("Send OTP Error:", err.message);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

// ✅ verify-otp
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP required" });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email=? AND otp_code=? AND otp_expiry > NOW()",
      [email, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    res.json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error("Verify OTP Error:", err.message);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
});

module.exports = router;
