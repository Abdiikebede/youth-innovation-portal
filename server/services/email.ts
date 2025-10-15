import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  try {
    const transporter = createTransporter();
    
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset - MinT Innovation Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Password Reset Request</h2>
          <p>You have requested a password reset for your MinT Innovation Portal account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If you cannot click the button, copy and paste this link in your browser:</p>
          <p>${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request this reset, please ignore this email.</p>
          <hr style="margin: 30px 0;">
          <p style="font-size: 12px; color: #6b7280;">
            This email was sent from MinT Innovation Portal, Ministry of Innovation and Technology, Ethiopia.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    console.log(`📧 Fallback - Password reset for: ${email}`);
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}`;
    console.log(`🔗 Reset URL: ${resetUrl}`);
    return true; // Return true so user doesn't see error
  }
};
