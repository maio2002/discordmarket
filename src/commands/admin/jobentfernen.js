const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const jobService = require('../../services/jobService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jobentfernen')
    .setDescription('Entferne den Job eines Nutzers')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');

    try {
      const job = await jobService.removeJob(interaction.guild.id, target.id, interaction.guild);
      await interaction.reply({
        content: `Job **${job.type}** von <@${target.id}> entfernt. ✅`,
      });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
