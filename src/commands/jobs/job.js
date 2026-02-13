const { SlashCommandBuilder } = require('discord.js');
const jobService = require('../../services/jobService');
const { JOB_SALARIES } = require('../../constants');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('job')
    .setDescription('Job-Informationen anzeigen')
    .addSubcommand(sub =>
      sub.setName('info').setDescription('Zeige Job-Übersicht und deinen aktuellen Job')
    )
    .addSubcommand(sub =>
      sub.setName('kuendigen').setDescription('Von deinem aktuellen Job zurücktreten')
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      const myJob = await jobService.getJob(interaction.guild.id, interaction.user.id);
      const allJobs = await jobService.getAllActiveJobs(interaction.guild.id);

      const jobList = Object.entries(JOB_SALARIES)
        .map(([type, salary]) => {
          const holders = allJobs.filter(j => j.type === type);
          return `**${type.charAt(0).toUpperCase() + type.slice(1)}** — ${formatCoins(salary)}/Woche (${holders.length} aktiv)`;
        })
        .join('\n');

      const fields = [
        { name: 'Verfügbare Jobs', value: jobList, inline: false },
      ];

      if (myJob) {
        fields.push({
          name: 'Dein Job',
          value: `**${myJob.type.charAt(0).toUpperCase() + myJob.type.slice(1)}** — ${formatCoins(myJob.salary)}/Woche\nSeit: <t:${Math.floor(new Date(myJob.assignedAt).getTime() / 1000)}:R>`,
          inline: false,
        });
      } else {
        fields.push({
          name: 'Dein Job',
          value: 'Keiner — Jobs werden vom Team zugewiesen.',
          inline: false,
        });
      }

      const embed = createEmbed({
        title: '💼 Job-Übersicht',
        color: COLORS.JOB,
        fields,
        footer: 'Jobs werden vom Team zugewiesen und bezahlen wöchentlich.',
      });

      await interaction.reply({ embeds: [embed] });
    }

    if (sub === 'kuendigen') {
      try {
        const job = await jobService.removeJob(interaction.guild.id, interaction.user.id, interaction.guild);
        await interaction.reply({
          content: `Du hast deinen Job als **${job.type}** gekündigt.`,
          ephemeral: true,
        });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }
  },
};
