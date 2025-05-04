import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';

// Email configuration
const EMAIL_FROM = 'team@meetmaximo.com';
const EMAIL_HOST = 'smtp.gmail.com';
const EMAIL_PORT = 465;
const EMAIL_SECURE = true;

// Create a nodemailer transporter using Google Workspace
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_SECURE, // true for 465, false for other ports
  auth: {
    user: EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD, // Add this to your .env file
  }
});

/**
 * Interface for email options
 */
export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
}

/**
 * Sends an email with optional attachments
 * @param options Email options including recipient, subject, content, and attachments
 * @returns Promise resolving to success status
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {    
    if (!process.env.EMAIL_PASSWORD) {
      console.error('❌ DEBUG: EMAIL_PASSWORD environment variable is not set!');
      return false;
    }
    
    const mailOptions = {
      from: `"Maximo AI Coach" <${EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      attachments: options.attachments || [],
    };
              
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (mailError) {
      return false;
    }
  } catch (error) {
    console.error('❌ DEBUG: Error in sendEmail function:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack available');
    return false;
  }
}

/**
 * Verifies the email configuration by testing the connection
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('❌ Email configuration verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
} 