const cron = require('node-cron');
const BorrowService = require('./borrow.service');

class SchedulerService {
   constructor() {
      this.jobs = [];
   }

   // Schedule daily email reminders at 9:00 AM
   scheduleDueDateReminders() {
      const job = cron.schedule('0 9 * * *', async () => {
         console.log('Running scheduled due date reminders...');
         try {
            const results = await BorrowService.sendDueDateReminders();
            console.log('Due date reminders completed:', results);
         } catch (error) {
            console.error('Error in scheduled due date reminders:', error);
         }
      }, {
         scheduled: false,
         timezone: "Asia/Jerusalem" // Adjust timezone as needed
      });

      this.jobs.push({ name: 'dueDateReminders', job });
      return job;
   }

   // Schedule daily overdue notifications at 10:00 AM
   scheduleOverdueNotifications() {
      const job = cron.schedule('0 10 * * *', async () => {
         console.log('Running scheduled overdue notifications...');
         try {
            const results = await BorrowService.sendOverdueNotifications();
            console.log('Overdue notifications completed:', results);
         } catch (error) {
            console.error('Error in scheduled overdue notifications:', error);
         }
      }, {
         scheduled: false,
         timezone: "Asia/Jerusalem" // Adjust timezone as needed
      });

      this.jobs.push({ name: 'overdueNotifications', job });
      return job;
   }

   // Start all scheduled jobs
   startAllJobs() {
      console.log('Starting all scheduled jobs...');

      // Schedule due date reminders
      const dueDateJob = this.scheduleDueDateReminders();
      dueDateJob.start();
      console.log('✓ Due date reminders scheduled for 9:00 AM daily');

      // Schedule overdue notifications
      const overdueJob = this.scheduleOverdueNotifications();
      overdueJob.start();
      console.log('✓ Overdue notifications scheduled for 10:00 AM daily');
   }

   // Stop all scheduled jobs
   stopAllJobs() {
      console.log('Stopping all scheduled jobs...');
      this.jobs.forEach(({ name, job }) => {
         job.stop();
         console.log(`✓ Stopped job: ${name}`);
      });
   }

   // Get status of all jobs
   getJobsStatus() {
      return this.jobs.map(({ name, job }) => ({
         name,
         running: job.running || false
      }));
   }
}

module.exports = new SchedulerService();
