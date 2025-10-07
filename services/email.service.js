const nodemailer = require('nodemailer');

class EmailService {
   constructor() {
      this.transporter = nodemailer.createTransport({
         host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
         port: process.env.EMAIL_PORT || 587,
         secure: false,
         auth: {
            user: process.env.EMAIL_USER || 'omar.hasan3894@gmail.com',
            pass: process.env.EMAIL_PASS
         }
      });
   }

   async sendDueDateReminder(userEmail, userName, bookTitle, dueDate) {
      const mailOptions = {
         from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
         to: userEmail,
         subject: 'تذكير: موعد إرجاع الكتاب',
         html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; text-align: center;">تذكير بإرجاع الكتاب</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; margin-bottom: 15px;">
              <strong>عزيزي/عزيزتي ${userName}،</strong>
            </p>
            
            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
              نذكركم بأن الكتاب المستعار منكم سيحين موعد إرجاعه قريباً.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-right: 4px solid #007bff; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>اسم الكتاب:</strong> ${bookTitle}</p>
              <p style="margin: 5px 0;"><strong>تاريخ الإرجاع المطلوب:</strong> ${new Date(dueDate).toLocaleDateString('ar-EG')}</p>
              <p style="margin: 5px 0;"><strong>الأيام المتبقية:</strong> 3 أيام</p>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; margin-top: 20px;">
              يرجى إرجاع الكتاب في الموعد المحدد لتجنب أي رسوم تأخير.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 12px; color: #6c757d;">
                شكراً لكم لاستخدام مكتبتنا
              </p>
            </div>
          </div>
        </div>
      `
      };

      try {
         const result = await this.transporter.sendMail(mailOptions);
         console.log('Email sent successfully:', result.messageId);
         return result;
      } catch (error) {
         console.error('Error sending email:', error);
         throw error;
      }
   }

   async sendOverdueNotification(userEmail, userName, bookTitle, daysOverdue) {
      const mailOptions = {
         from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
         to: userEmail,
         subject: 'تنبيه: تأخير في إرجاع الكتاب',
         html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc3545; text-align: center;">تنبيه: تأخير في إرجاع الكتاب</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; margin-bottom: 15px;">
              <strong>عزيزي/عزيزتي ${userName}،</strong>
            </p>
            
            <p style="font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
              نود إعلامكم بأن الكتاب المستعار منكم قد تأخر موعد إرجاعه.
            </p>
            
            <div style="background-color: #fff; padding: 15px; border-right: 4px solid #dc3545; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>اسم الكتاب:</strong> ${bookTitle}</p>
              <p style="margin: 5px 0; color: #dc3545;"><strong>عدد أيام التأخير:</strong> ${daysOverdue} يوم</p>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; margin-top: 20px;">
              يرجى إرجاع الكتاب في أقرب وقت ممكن.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 12px; color: #6c757d;">
                شكراً لكم لاستخدام مكتبتنا
              </p>
            </div>
          </div>
        </div>
      `
      };

      try {
         const result = await this.transporter.sendMail(mailOptions);
         console.log('Overdue email sent successfully:', result.messageId);
         return result;
      } catch (error) {
         console.error('Error sending overdue email:', error);
         throw error;
      }
   }
}

module.exports = new EmailService();
