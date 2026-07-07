const logger = require('../utils/logger');
const { resumeAllPanels } = require('../services/statusPanelService');
const { resumeAllBoards } = require('../services/dutyBoardService');
const { checkExpiredLoas } = require('../services/loaService');
const { checkScheduledReport } = require('../services/staffHoursService');

const LOA_CHECK_INTERVAL_MS = 60 * 1000; // check for expired LOAs every minute
const HOURS_CHECK_INTERVAL_MS = 60 * 60 * 1000; // check staff-hours schedule every hour

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.success(`Logged in as ${client.user.tag}`);
    client.user.setPresence({ activities: [{ name: 'over the staff team' }], status: 'online' });

    await resumeAllPanels(client);
    await resumeAllBoards(client);

    setInterval(() => checkExpiredLoas(client).catch((err) => logger.error('LOA expiry check failed', { err: err.message })), LOA_CHECK_INTERVAL_MS);

    setInterval(async () => {
      for (const [, guild] of client.guilds.cache) {
        checkScheduledReport(client, guild).catch((err) =>
          logger.error('Staff hours scheduled check failed', { guildId: guild.id, err: err.message })
        );
      }
    }, HOURS_CHECK_INTERVAL_MS);
  },
};
