const { SlashCommandBuilder } = require('discord.js');
const ratService = require('../../services/ratService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antrag')
    .setDescription('Serverrat – Anträge einreichen und einsehen')
    .addSubcommand(sub => sub
      .setName('stellen')
      .setDescription('Einen neuen Antrag im Serverrat einreichen (nur Gildenführer)')
      .addStringOption(opt => opt.setName('titel').setDescription('Titel des Antrags').setRequired(true).setMaxLength(80))
      .addStringOption(opt => opt.setName('inhalt').setDescription('Inhalt / Begründung').setRequired(true).setMaxLength(800))
      .addStringOption(opt => opt
        .setName('typ')
        .setDescription('Art des Antrags')
        .setRequired(false)
        .addChoices(
          { name: 'Allgemeiner Antrag', value: 'motion' },
          { name: 'Verfassungsänderung', value: 'amendment' },
        ))
      .addStringOption(opt => opt
        .setName('verfassungstext')
        .setDescription('Neuer Verfassungstext (nur bei Verfassungsänderung)')
        .setRequired(false)
        .setMaxLength(2000))
    )
    .addSubcommand(sub => sub
      .setName('liste')
      .setDescription('Aktive Anträge anzeigen')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'stellen') return ratService.handleProposalCreate(interaction);
    if (sub === 'liste')   return ratService.handleProposalList(interaction);
  },
};
