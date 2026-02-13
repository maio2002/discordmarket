const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Bot-Einstellungen konfigurieren')
    .addSubcommand(sub =>
      sub
        .setName('anzeigen')
        .setDescription('Aktuelle Konfiguration anzeigen')
    )
    .addSubcommand(sub =>
      sub
        .setName('marktkanal')
        .setDescription('Marktplatz-Kanal setzen')
        .addChannelOption(opt =>
          opt.setName('kanal').setDescription('Der Kanal').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('logkanal')
        .setDescription('Log-Kanal setzen')
        .addChannelOption(opt =>
          opt.setName('kanal').setDescription('Der Kanal').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('genehmigungskanal')
        .setDescription('Genehmigungskanal setzen')
        .addChannelOption(opt =>
          opt.setName('kanal').setDescription('Der Kanal').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('memberrolle')
        .setDescription('Member-Rolle setzen (für wöchentliche Boni)')
        .addRoleOption(opt =>
          opt.setName('rolle').setDescription('Die Rolle').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('viprolle')
        .setDescription('VIP-Rolle setzen (für wöchentliche Boni)')
        .addRoleOption(opt =>
          opt.setName('rolle').setDescription('Die Rolle').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    let config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      config = await GuildConfig.create({ guildId: interaction.guild.id });
    }

    if (sub === 'anzeigen') {
      const embed = createEmbed({
        title: 'Bot-Konfiguration',
        color: COLORS.PRIMARY,
        fields: [
          { name: 'Marktkanal', value: config.marketChannelId ? `<#${config.marketChannelId}>` : 'Nicht gesetzt', inline: true },
          { name: 'Logkanal', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Nicht gesetzt', inline: true },
          { name: 'Genehmigungskanal', value: config.approvalChannelId ? `<#${config.approvalChannelId}>` : 'Nicht gesetzt', inline: true },
          { name: 'Member-Rolle', value: config.memberRoleId ? `<@&${config.memberRoleId}>` : 'Nicht gesetzt', inline: true },
          { name: 'VIP-Rolle', value: config.vipRoleId ? `<@&${config.vipRoleId}>` : 'Nicht gesetzt', inline: true },
        ],
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'marktkanal') {
      config.marketChannelId = interaction.options.getChannel('kanal').id;
    } else if (sub === 'logkanal') {
      config.logChannelId = interaction.options.getChannel('kanal').id;
    } else if (sub === 'genehmigungskanal') {
      config.approvalChannelId = interaction.options.getChannel('kanal').id;
    } else if (sub === 'memberrolle') {
      config.memberRoleId = interaction.options.getRole('rolle').id;
    } else if (sub === 'viprolle') {
      config.vipRoleId = interaction.options.getRole('rolle').id;
    }

    await config.save();
    await interaction.reply({ content: `Einstellung **${sub}** wurde aktualisiert. ✅`, ephemeral: true });
  },
};
