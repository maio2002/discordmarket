const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const questService = require('../../services/questService');
const Quest = require('../../models/Quest');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest-entfernen')
    .setDescription('Entferne oder breche eine Quest ab')
    .addStringOption(opt =>
      opt.setName('quest').setDescription('Titel der Quest').setRequired(true).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const quests = await Quest.find({
      guildId: interaction.guild.id,
      status: { $in: ['open', 'claimed'] },
    }).lean();
    const filtered = quests
      .filter(q => q.title.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(q => ({ name: `${q.title} (${q.status})`, value: q._id.toString() }));
    await interaction.respond(filtered);
  },
  async execute(interaction) {
    const questId = interaction.options.getString('quest');

    try {
      const quest = await questService.cancelQuest(interaction.guild.id, questId);

      const embed = createEmbed({
        title: 'Quest abgebrochen ✅',
        color: COLORS.WARNING,
        description: `**${quest.title}** wurde abgebrochen.`,
      });
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
