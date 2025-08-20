// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const nodemailer = require("nodemailer");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeIndian(phone) {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  return null;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

/* ========== send-otp ========== */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: "Valid email required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    // No created_at / updated_at usage
    await pool.query(
      `
      INSERT INTO users (email, otp_code, otp_expiry)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
      ON DUPLICATE KEY UPDATE
        otp_code = VALUES(otp_code),
        otp_expiry = VALUES(otp_expiry)
      `,
      [email, String(otp)]
    );

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "Your Family Chat OTP",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      html: `<p>Your OTP is <b>${otp}</b>. It will expire in <b>5 minutes</b>.</p>`,
    });

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("send-otp error:", err);
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

/* ========== verify-otp ========== */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !EMAIL_RE.test(email) || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP required" });
    }

    const [rows] = await pool.query(
      `SELECT id FROM users WHERE email=? AND otp_code=? AND otp_expiry > NOW() LIMIT 1`,
      [email, String(otp)]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // No updated_at; just clear otp and mark verified if column exists
    await pool.query(
      `UPDATE users
         SET email_verified_at = IFNULL(email_verified_at, NOW()),
             otp_code = NULL
       WHERE email = ?`,
      [email]
    );

    return res.json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error("verify-otp error:", err);
    return res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
});

/* ========== link-phone (India-only, set-once) ========== */
router.post("/link-phone", async (req, res) => {
  try {
    const { email, phone } = req.body || {};
    if (!email || !EMAIL_RE.test(email) || !phone) {
      return res.status(400).json({ success: false, message: "Email and phone are required" });
    }

    const e164 = normalizeIndian(phone);
    if (!e164) {
      return res.status(400).json({
        success: false,
        message: "Invalid Indian mobile. Use a 10-digit number starting 6–9 (e.g., 9876543210).",
      });
    }

    // Set once: only if currently NULL
    const [result] = await pool.query(
      `UPDATE users
          SET phone = ?
        WHERE email = ? AND phone IS NULL`,
      [e164, email]
    );

    if (result.affectedRows === 1) {
      return res.json({ success: true, message: "Phone linked", phone: e164 });
    }

    return res.status(409).json({
      success: false,
      message: "Phone already set for this account and cannot be changed.",
      code: "PHONE_IMMUTABLE",
    });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This phone number is already linked to another account.",
        code: "PHONE_TAKEN",
      });
    }
    console.error("link-phone error:", err);
    return res.status(500).json({ success: false, message: "Failed to link phone" });
  }
});

module.exports = router;
