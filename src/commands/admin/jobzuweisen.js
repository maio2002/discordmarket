const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const jobService = require('../../services/jobService');
const { JOB_SALARIES } = require('../../constants');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jobzuweisen')
    .setDescription('Weise einem Nutzer einen Job zu')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('typ')
        .setDescription('Job-Typ')
        .setRequired(true)
        .addChoices(
          { name: 'Moderator (7.000/Woche)', value: 'moderator' },
          { name: 'Support (5.000/Woche)', value: 'support' },
          { name: 'Advertisement (3.000/Woche)', value: 'advertisement' },
          { name: 'Examiner (4.000/Woche)', value: 'examiner' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const type = interaction.options.getString('typ');

    try {
      const job = await jobService.assignJob(
        interaction.guild.id,
        target.id,
        type,
        interaction.user.id,
        interaction.guild
      );

      const embed = createEmbed({
        title: 'Job zugewiesen ✅',
        color: COLORS.JOB,
        fields: [
          { name: 'Nutzer', value: `<@${target.id}>`, inline: true },
          { name: 'Job', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
          { name: 'Gehalt', value: `${formatCoins(JOB_SALARIES[type])}/Woche`, inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
