const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unbekanntes Kommando: ${interaction.commandName}`);
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Fehler bei /${interaction.commandName}:`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Autocomplete-Fehler bei /${interaction.commandName}:`, error);
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        logger.error(`Button-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }
  },
};

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id.startsWith('approve_role_') || id.startsWith('deny_role_')) {
    const approvalService = require('../services/approvalService');
    return approvalService.handleRoleApprovalButton(interaction);
  }

  if (id.startsWith('approve_coins_') || id.startsWith('deny_coins_')) {
    const approvalService = require('../services/approvalService');
    return approvalService.handleCoinsApprovalButton(interaction);
  }

  if (id.startsWith('trade_accept_') || id.startsWith('trade_deny_')) {
    const tradeService = require('../services/tradeService');
    return tradeService.handleTradeButton(interaction);
  }

  if (id.startsWith('page_')) {
    const pagination = require('../utils/pagination');
    return pagination.handlePageButton(interaction);
  }
}
