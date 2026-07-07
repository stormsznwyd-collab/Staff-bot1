const { handleVoiceStateChange } = require('../services/dutyService');
const logger = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    try {
      await handleVoiceStateChange(oldState, newState);
    } catch (err) {
      logger.error('voiceStateUpdate handler failed', { err: err.message });
    }
  },
};
