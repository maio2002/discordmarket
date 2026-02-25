const { SlashCommandBuilder } = require('discord.js');
const seatService = require('../../services/seatService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sitze')
    .setDescription('Sitzverteilung im Rat verwalten')
    .addSubcommand(sub =>
      sub
        .setName('anzeigen')
        .setDescription('Aktuelle Sitzverteilung aller Fraktionen anzeigen'),
    )
    .addSubcommand(sub =>
      sub
        .setName('vergeben')
        .setDescription('Einem Mitglied deiner Fraktion einen Sitz geben'),
    )
    .addSubcommand(sub =>
      sub
        .setName('entziehen')
        .setDescription('Einem Mitglied deiner Fraktion den Sitz entziehen'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'anzeigen')  return seatService.handleSeatList(interaction);
    if (sub === 'vergeben')  return seatService.handleSeatAssign(interaction);
    if (sub === 'entziehen') return seatService.handleSeatRevoke(interaction);
  },
};
