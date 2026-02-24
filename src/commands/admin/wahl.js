const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ratService = require('../../services/ratService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wahl')
    .setDescription('Wahlen starten und einsehen')
    .addSubcommand(sub => sub
      .setName('starten')
      .setDescription('Neue Wahl starten (Admin)')
      .addStringOption(opt => opt.setName('titel').setDescription('z.B. Wahl zum Moderator').setRequired(true).setMaxLength(80))
      .addRoleOption(opt => opt.setName('rolle').setDescription('Rolle die der Gewinner erhält').setRequired(true))
      .addIntegerOption(opt => opt.setName('stunden').setDescription('Gesamtdauer in Stunden (Standard: 48)').setRequired(false).setMinValue(1).setMaxValue(168))
    )
    .addSubcommand(sub => sub
      .setName('liste')
      .setDescription('Aktive Wahlen anzeigen')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'starten') return ratService.handleElectionCreate(interaction);
    if (sub === 'liste')   return ratService.handleElectionList(interaction);
  },
};
