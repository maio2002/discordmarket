const { SlashCommandBuilder } = require('discord.js');
const ratService = require('../../services/ratService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verfassung')
    .setDescription('Serververfassung anzeigen oder bearbeiten')
    .addSubcommand(sub => sub
      .setName('anzeigen')
      .setDescription('Die aktuelle Serververfassung anzeigen')
    )
    .addSubcommand(sub => sub
      .setName('bearbeiten')
      .setDescription('Verfassung direkt überschreiben (nur Admin — für Änderungen lieber /antrag stellen)')
      .addStringOption(opt => opt
        .setName('text')
        .setDescription('Der vollständige neue Verfassungstext')
        .setRequired(true)
        .setMaxLength(4000))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'anzeigen')   return ratService.handleConstitutionView(interaction);
    if (sub === 'bearbeiten') return ratService.handleConstitutionEdit(interaction);
  },
};
