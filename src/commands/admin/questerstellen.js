const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const questService = require('../../services/questService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest-erstellen')
    .setDescription('Erstelle eine neue Quest')
    .addStringOption(opt =>
      opt.setName('titel').setDescription('Titel der Quest').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('beschreibung').setDescription('Beschreibung der Quest').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('belohnung').setDescription('Belohnung in Coins').setRequired(true).setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const title = interaction.options.getString('titel');
    const description = interaction.options.getString('beschreibung');
    const reward = interaction.options.getInteger('belohnung');

    try {
      const quest = await questService.createQuest(
        interaction.guild.id,
        title,
        description,
        reward,
        interaction.user.id
      );

      const embed = createEmbed({
        title: 'Quest erstellt ✅',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Titel', value: quest.title, inline: true },
          { name: 'Belohnung', value: formatCoins(reward), inline: true },
        ],
        description: `> ${description}`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
