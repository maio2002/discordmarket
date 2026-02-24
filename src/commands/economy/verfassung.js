const { SlashCommandBuilder } = require('discord.js');
const ratService = require('../../services/ratService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verfassung')
    .setDescription('Serververfassung anzeigen oder bearbeiten')
    .addSubcommand(sub => sub
      .setName('anzeigen')
      .setDescription('Die aktuelle Serververfassung für alle anzeigen')
    )
    .addSubcommand(sub => sub
      .setName('bearbeiten')
      .setDescription('Verfassung im Editor öffnen und überschreiben (nur Admin)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'anzeigen')   return ratService.handleConstitutionView(interaction);
    if (sub === 'bearbeiten') return ratService.showConstitutionModal(interaction);
  },
};
