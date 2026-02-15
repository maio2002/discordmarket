const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unbekanntes Kommando: ${interaction.commandName}`);
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Fehler bei /${interaction.commandName}:`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Autocomplete-Fehler bei /${interaction.commandName}:`, error);
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        logger.error(`Button-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isUserSelectMenu()) {
      try {
        await handleUserSelectMenu(interaction);
      } catch (error) {
        logger.error(`UserSelect-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      try {
        await handleModal(interaction);
      } catch (error) {
        logger.error(`Modal-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenu(interaction);
      } catch (error) {
        logger.error(`Select-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }
  },
};

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id.startsWith('approve_role_') || id.startsWith('deny_role_')) {
    const approvalService = require('../services/approvalService');
    return approvalService.handleRoleApprovalButton(interaction);
  }

  if (id.startsWith('approve_coins_') || id.startsWith('deny_coins_')) {
    const approvalService = require('../services/approvalService');
    return approvalService.handleCoinsApprovalButton(interaction);
  }

  if (id.startsWith('trade_accept_direct_') || id.startsWith('trade_accept_role_') || id.startsWith('trade_accept_service_') || id.startsWith('trade_deny_direct_')) {
    // Handled below (Offer-based accept/deny)
  } else if (id.startsWith('trade_accept_') || id.startsWith('trade_deny_')) {
    const tradeService = require('../services/tradeService');
    return tradeService.handleTradeButton(interaction);
  }

  if (id.startsWith('page_')) {
    const pagination = require('../utils/pagination');
    return pagination.handlePageButton(interaction);
  }

  // Quest ticket: Geschafft
  if (id.startsWith('quest_complete_')) {
    const questService = require('../services/questService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const questId = parts[2];
    const userId = parts[3];

    try {
      const quest = await questService.completeQuestForUser(
        interaction.guild.id, questId, userId, interaction.user.id, interaction.guild
      );
      const embed = createEmbed({
        title: '✅ Quest bestanden!',
        color: COLORS.SUCCESS,
        description: `<@${userId}> hat die Quest **${quest.title}** abgeschlossen und ${formatCoins(quest.reward)} erhalten.\n\nDieser Channel wird in 5 Sekunden gelöscht.`,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      const embed = createEmbed({
        title: '⚠️ Fehler',
        color: COLORS.ERROR,
        description: err.message,
      });
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }

  // Quest ticket: Nicht geschafft
  if (id.startsWith('quest_fail_')) {
    const questService = require('../services/questService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const parts = id.split('_');
    const questId = parts[2];
    const userId = parts[3];

    try {
      await questService.failQuestForUser(
        interaction.guild.id, questId, userId, interaction.user.id, interaction.guild
      );
      const embed = createEmbed({
        title: '❌ Quest nicht geschafft',
        color: COLORS.ERROR,
        description: `<@${userId}> hat die Quest nicht bestanden.\n\nDieser Channel wird in 5 Sekunden gelöscht.`,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      const embed = createEmbed({
        title: '⚠️ Fehler',
        color: COLORS.ERROR,
        description: err.message,
      });
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }

  // Offer ticket: Abgeschlossen (Auftraggeber)
  if (id.startsWith('offer_complete_')) {
    const coinService = require('../services/coinService');
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const offerId = parts[2];
    const channelId = parts[3];

    const offer = await Offer.findById(offerId).lean();
    if (!offer) {
      return interaction.reply({ content: '❌ Dieser Auftrag existiert nicht mehr.', ephemeral: true });
    }
    if (interaction.user.id !== offer.senderId) {
      return interaction.reply({ content: '❌ Nur der Auftraggeber kann den Auftrag abschließen.', ephemeral: true });
    }

    // Coins an Auftragnehmer zahlen
    if (offer.price > 0) {
      await coinService.transfer(interaction.guild.id, offer.senderId, offer.targetId, offer.price, 'trade', `Auftrag abgeschlossen: ${(offer.description || '').slice(0, 30)}`);
    }

    const embed = createEmbed({
      title: '✅ Auftrag abgeschlossen!',
      color: COLORS.SUCCESS,
      description: `<@${offer.targetId}> hat **${formatCoins(offer.price || 0)}** für den Auftrag erhalten.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
    });
    await interaction.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const ch = await interaction.guild.channels.fetch(channelId);
        if (ch) await ch.delete();
      } catch {}
    }, 10000);
    return;
  }

  // Offer ticket: Stornieren (Auftraggeber)
  if (id.startsWith('offer_cancel_')) {
    const coinService = require('../services/coinService');
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const offerId = parts[2];
    const channelId = parts[3];

    const offer = await Offer.findById(offerId).lean();
    if (!offer) {
      return interaction.reply({ content: '❌ Dieser Auftrag existiert nicht mehr.', ephemeral: true });
    }
    if (interaction.user.id !== offer.senderId) {
      return interaction.reply({ content: '❌ Nur der Auftraggeber kann stornieren.', ephemeral: true });
    }

    // 50% Storno-Gebühr an Auftragnehmer
    const cancelFee = Math.ceil((offer.price || 0) / 2);
    if (cancelFee > 0) {
      await coinService.transfer(interaction.guild.id, offer.senderId, offer.targetId, cancelFee, 'trade', `Storno-Gebühr: ${(offer.description || '').slice(0, 30)}`);
    }

    const embed = createEmbed({
      title: '❌ Auftrag storniert',
      color: COLORS.ERROR,
      description: `Der Auftrag wurde storniert. <@${offer.targetId}> erhält **${formatCoins(cancelFee)}** als Storno-Gebühr.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
    });
    await interaction.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const ch = await interaction.guild.channels.fetch(channelId);
        if (ch) await ch.delete();
      } catch {}
    }, 10000);
    return;
  }

  // Job ticket: Annehmen (Admin)
  if (id.startsWith('job_accept_')) {
    const JobListing = require('../models/JobListing');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const jobId = parts[2];
    const applicantId = parts[3];
    const channelId = parts[4];

    if (!interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Nur Admins können Bewerbungen annehmen.', ephemeral: true });
    }

    const listing = await JobListing.findById(jobId).lean();
    if (!listing) {
      return interaction.reply({ content: '❌ Diese Stelle existiert nicht mehr.', ephemeral: true });
    }

    // Assign role
    if (listing.roleId) {
      try {
        const member = await interaction.guild.members.fetch(applicantId);
        await member.roles.add(listing.roleId);
      } catch (err) {
        const logger = require('../utils/logger');
        logger.error(`Job-Rolle konnte nicht zugewiesen werden: ${err.message}`);
      }
    }

    const roleInfo = listing.roleId ? ` und die Rolle <@&${listing.roleId}> erhalten` : '';
    const embed = createEmbed({
      title: '✅ Bewerbung angenommen!',
      color: COLORS.SUCCESS,
      description: `<@${applicantId}> wurde für **${listing.title}** angenommen${roleInfo}.\n\nGehalt: ${formatCoins(listing.salary || 0)}/Woche\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
    });
    await interaction.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const ch = await interaction.guild.channels.fetch(channelId);
        if (ch) await ch.delete();
      } catch {}
    }, 10000);
    return;
  }

  // Job ticket: Ablehnen (Admin)
  if (id.startsWith('job_deny_')) {
    const JobListing = require('../models/JobListing');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const parts = id.split('_');
    const jobId = parts[2];
    const applicantId = parts[3];
    const channelId = parts[4];

    if (!interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Nur Admins können Bewerbungen ablehnen.', ephemeral: true });
    }

    const listing = await JobListing.findById(jobId).lean();
    const title = listing ? listing.title : 'Unbekannte Stelle';

    const embed = createEmbed({
      title: '❌ Bewerbung abgelehnt',
      color: COLORS.ERROR,
      description: `Die Bewerbung von <@${applicantId}> für **${title}** wurde abgelehnt.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
    });
    await interaction.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const ch = await interaction.guild.channels.fetch(channelId);
        if (ch) await ch.delete();
      } catch {}
    }, 10000);
    return;
  }

  // Service ticket: Annehmen (Anbieter)
  if (id.startsWith('service_accept_')) {
    const Service = require('../models/Service');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const parts = id.split('_');
    const serviceId = parts[2];
    const requesterId = parts[3];
    const channelId = parts[4];

    const service = await Service.findById(serviceId).lean();
    if (!service) {
      return interaction.reply({ content: '❌ Dienstleistung nicht gefunden.', ephemeral: true });
    }
    if (interaction.user.id !== service.providerId) {
      return interaction.reply({ content: '❌ Nur der Anbieter kann diese Anfrage annehmen.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '✅ Dienstleistung angenommen!',
      color: COLORS.SUCCESS,
      description: `<@${service.providerId}> hat die Anfrage angenommen.\n\n> **${service.name}** — ${formatCoins(service.price)}\n\nDer Ticket-Channel bleibt offen. Sobald die Dienstleistung erbracht wurde, kann <@${requesterId}> sie als abgeschlossen markieren.`,
    });

    const completeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`service_complete_${serviceId}_${requesterId}_${channelId}`)
        .setLabel('Abgeschlossen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`service_cancel_${serviceId}_${requesterId}_${channelId}`)
        .setLabel(`Stornieren (${formatCoins(Math.ceil(service.price / 2))})`)
        .setEmoji('🚫')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.update({ embeds: [embed], components: [completeRow] });
    return;
  }

  // Service ticket: Abgeschlossen (Kunde/Nachfrager)
  if (id.startsWith('service_complete_')) {
    const coinService = require('../services/coinService');
    const Service = require('../models/Service');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const serviceId = parts[2];
    const requesterId = parts[3];
    const channelId = parts[4];

    if (interaction.user.id !== requesterId) {
      return interaction.reply({ content: '❌ Nur der Auftraggeber kann die Dienstleistung als abgeschlossen markieren.', ephemeral: true });
    }

    const service = await Service.findById(serviceId).lean();
    if (!service) {
      return interaction.reply({ content: '❌ Dienstleistung nicht gefunden.', ephemeral: true });
    }

    try {
      await coinService.transfer(interaction.guild.id, requesterId, service.providerId, service.price, 'service', `Dienstleistung: ${service.name}`);

      const embed = createEmbed({
        title: '🎉 Dienstleistung abgeschlossen!',
        color: COLORS.SUCCESS,
        description: `<@${requesterId}> hat die Dienstleistung **${service.name}** als abgeschlossen markiert.\n\n> **${formatCoins(service.price)}** wurden an <@${service.providerId}> übertragen.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
      });
      await interaction.update({ embeds: [embed], components: [] });

      setTimeout(async () => {
        try {
          const ch = await interaction.guild.channels.fetch(channelId);
          if (ch) await ch.delete();
        } catch {}
      }, 10000);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    return;
  }

  // Service ticket: Stornieren (Kunde/Nachfrager — halber Preis)
  if (id.startsWith('service_cancel_')) {
    const coinService = require('../services/coinService');
    const Service = require('../models/Service');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const serviceId = parts[2];
    const requesterId = parts[3];
    const channelId = parts[4];

    if (interaction.user.id !== requesterId) {
      return interaction.reply({ content: '❌ Nur der Auftraggeber kann die Dienstleistung stornieren.', ephemeral: true });
    }

    const service = await Service.findById(serviceId).lean();
    if (!service) {
      return interaction.reply({ content: '❌ Dienstleistung nicht gefunden.', ephemeral: true });
    }

    const cancelFee = Math.ceil(service.price / 2);

    try {
      await coinService.transfer(interaction.guild.id, requesterId, service.providerId, cancelFee, 'service', `Stornierung: ${service.name} (50%)`);

      const embed = createEmbed({
        title: '🚫 Dienstleistung storniert',
        color: COLORS.WARNING,
        description: `<@${requesterId}> hat die Dienstleistung **${service.name}** storniert.\n\n> Stornogebühr: **${formatCoins(cancelFee)}** (50%) an <@${service.providerId}> übertragen.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
      });
      await interaction.update({ embeds: [embed], components: [] });

      setTimeout(async () => {
        try {
          const ch = await interaction.guild.channels.fetch(channelId);
          if (ch) await ch.delete();
        } catch {}
      }, 10000);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    return;
  }

  // Service ticket: Ablehnen (Anbieter)
  if (id.startsWith('service_deny_')) {
    const Service = require('../models/Service');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const parts = id.split('_');
    const serviceId = parts[2];
    const requesterId = parts[3];
    const channelId = parts[4];

    const service = await Service.findById(serviceId).lean();
    if (!service) {
      return interaction.reply({ content: '❌ Dienstleistung nicht gefunden.', ephemeral: true });
    }
    if (interaction.user.id !== service.providerId) {
      return interaction.reply({ content: '❌ Nur der Anbieter kann diese Anfrage ablehnen.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '❌ Dienstleistung abgelehnt',
      color: COLORS.ERROR,
      description: `<@${service.providerId}> hat die Anfrage von <@${requesterId}> für **${service.name}** abgelehnt.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
    });
    await interaction.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const ch = await interaction.guild.channels.fetch(channelId);
        if (ch) await ch.delete();
      } catch {}
    }, 10000);
    return;
  }

  // Shop open button
  if (id === 'shop_open') {
    const { buildShopResponse } = require('../services/shopService');
    const { embed, components } = await buildShopResponse(interaction.guild.id, 'roles', 1);
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  }

  // Shop balance button
  if (id === 'shop_balance') {
    const xpService = require('../services/xpService');
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { LEVEL } = require('../constants');
    const user = await xpService.getOrCreateUser(interaction.guild.id, interaction.user.id);
    const isMaxLevel = user.level >= LEVEL.MAX_LEVEL;
    const currentRank = await xpService.getRankDisplay(interaction.guild.id, user.level);
    const nextLevelCost = isMaxLevel ? 0 : xpService.costForLevel(user.level + 1);
    const nextRank = isMaxLevel ? null : await xpService.getRankDisplay(interaction.guild.id, user.level + 1);

    const pendingCount = await Offer.countDocuments({ guildId: interaction.guild.id, targetId: interaction.user.id, status: 'pending' });

    const fields = [
      { name: 'Rang', value: user.level > 0 ? currentRank : 'Kein Rang', inline: true },
      { name: 'Nächster Rang', value: isMaxLevel ? 'Max erreicht' : `${nextRank} — ${formatCoins(user.levelProgress || 0)}/${formatCoins(nextLevelCost)}`, inline: true },
    ];
    if (pendingCount > 0) {
      fields.push({ name: '📬 Postfach', value: `**${pendingCount}** neue Meldung${pendingCount > 1 ? 'en' : ''}`, inline: true });
    }

    const embed = createEmbed({
      title: '💰 Dein Kontostand',
      description: `Du hast **${formatCoins(user.coins)}**`,
      color: COLORS.GOLD,
      thumbnail: interaction.user.displayAvatarURL(),
      fields,
    });

    const buttons = [];
    if (!isMaxLevel) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('shop_levelup')
          .setLabel('Aufleveln')
          .setEmoji('⬆️')
          .setStyle(ButtonStyle.Primary),
      );
    }
    buttons.push(
      new ButtonBuilder()
        .setCustomId('shop_send')
        .setLabel('Senden')
        .setEmoji('📤')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('shop_offers')
        .setLabel(pendingCount > 0 ? `Postfach (${pendingCount})` : 'Postfach')
        .setEmoji('📬')
        .setStyle(ButtonStyle.Secondary),
    );

    const components = [new ActionRowBuilder().addComponents(buttons)];
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  }

  // Level up button - show modal
  if (id === 'shop_levelup') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_levelup')
      .setTitle('Aufleveln');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Wie viele Coins möchtest du einzahlen?')
          .setPlaceholder('z.B. 500')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
    );
    interaction.message.edit({ content: '⏳', embeds: [], components: [] }).catch(() => {});
    return interaction.showModal(modal);
  }

  // Direct offer accept
  if (id.startsWith('trade_accept_direct_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_accept_direct_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht für dich.', ephemeral: true });
    }

    try {
      if (offer.type === 'coins') {
        // Coins wurden bereits vom Sender abgezogen — jetzt dem Empfänger gutschreiben
        await coinService.addCoins(interaction.guild.id, offer.targetId, offer.price, 'trade', `Coins erhalten von <@${offer.senderId}>`);

        offer.status = 'accepted';
        await offer.save();

        await Offer.create({
          guildId: offer.guildId,
          senderId: offer.targetId,
          targetId: offer.senderId,
          type: 'notification',
          description: `✅ <@${offer.targetId}> hat deine Überweisung von **${formatCoins(offer.price)}** angenommen.`,
          price: offer.price,
        });

        const embed = createEmbed({
          title: '✅ Angenommen!',
          color: COLORS.SUCCESS,
          description: `Du hast **${formatCoins(offer.price)}** von <@${offer.senderId}> erhalten.`,
        });
        return interaction.update({ embeds: [embed], components: [] });
      }

      // Offer-Typ: Ticket erstellen
      const { ChannelType, PermissionFlagsBits, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const guild = interaction.guild;
      const targetMember = await guild.members.fetch(offer.targetId);
      const senderMember = await guild.members.fetch(offer.senderId);
      const targetName = targetMember.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
      const offerName = (offer.description || 'auftrag').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);

      const channel = await guild.channels.create({
        name: `auftrag-${offerName}-${targetName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
          { id: targetMember.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: senderMember.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      offer.status = 'accepted';
      await offer.save();

      const ticketEmbed = createEmbed({
        title: `📋 Auftrag: ${(offer.description || '').slice(0, 50)}`,
        description: offer.description || 'Kein Beschreibung',
        color: COLORS.MARKET,
        fields: [
          { name: 'Auftraggeber', value: `<@${offer.senderId}>`, inline: true },
          { name: 'Auftragnehmer', value: `<@${offer.targetId}>`, inline: true },
          { name: 'Preis', value: formatCoins(offer.price || 0), inline: true },
        ],
        footer: 'Der Auftraggeber kann den Auftrag als abgeschlossen markieren oder stornieren.',
      });

      const cancelFee = Math.ceil((offer.price || 0) / 2);
      const ticketButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`offer_complete_${offer._id}_${channel.id}`)
          .setLabel('Abgeschlossen')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`offer_cancel_${offer._id}_${channel.id}`)
          .setLabel(`Stornieren (${formatCoins(cancelFee)})`)
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger),
      );

      await channel.send({ content: `<@${offer.senderId}> <@${offer.targetId}>`, embeds: [ticketEmbed], components: [ticketButtons] });

      const confirmEmbed = createEmbed({
        title: '✅ Auftrag angenommen!',
        color: COLORS.SUCCESS,
        description: `Ticket erstellt: <#${channel.id}>`,
      });
      return interaction.update({ embeds: [confirmEmbed], components: [] });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // Direct role trade accept
  if (id.startsWith('trade_accept_role_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_accept_role_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht für dich.', ephemeral: true });
    }

    try {
      await coinService.transfer(interaction.guild.id, offer.targetId, offer.senderId, offer.price, 'trade', `Rollenkauf: <@&${offer.roleId}>`);

      const sellerMember = await interaction.guild.members.fetch(offer.senderId);
      const buyerMember = await interaction.guild.members.fetch(offer.targetId);

      if (sellerMember.roles.cache.has(offer.roleId)) {
        await sellerMember.roles.remove(offer.roleId).catch(() => {});
      }
      await buyerMember.roles.add(offer.roleId).catch(() => {});

      offer.status = 'accepted';
      await offer.save();

      // Benachrichtigung für den Sender
      await Offer.create({
        guildId: offer.guildId,
        senderId: offer.targetId,
        targetId: offer.senderId,
        type: 'notification',
        description: `✅ <@${offer.targetId}> hat dein Rollenangebot **${offer.roleName}** für **${formatCoins(offer.price)}** angenommen.`,
        price: offer.price,
      });

      const embed = createEmbed({
        title: '✅ Rollenangebot angenommen!',
        color: COLORS.SUCCESS,
        description: `Du hast **${formatCoins(offer.price)}** bezahlt und die Rolle <@&${offer.roleId}> erhalten.`,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // Service request accept
  if (id.startsWith('trade_accept_service_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_accept_service_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Diese Anfrage ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Diese Anfrage ist nicht für dich.', ephemeral: true });
    }

    try {
      await coinService.transfer(interaction.guild.id, offer.senderId, offer.targetId, offer.price, 'service', `Dienstleistung: ${offer.serviceName}`);
      offer.status = 'accepted';
      await offer.save();

      // Benachrichtigung für den Anfragenden
      await Offer.create({
        guildId: offer.guildId,
        senderId: offer.targetId,
        targetId: offer.senderId,
        type: 'notification',
        description: `✅ <@${offer.targetId}> hat deine Anfrage für **${offer.serviceName}** (${formatCoins(offer.price)}) angenommen.`,
        price: offer.price,
      });

      const embed = createEmbed({
        title: '✅ Service-Anfrage angenommen!',
        color: COLORS.SUCCESS,
        description: `Du hast die Anfrage von <@${offer.senderId}> für **${offer.serviceName}** angenommen.\n\n> **${formatCoins(offer.price)}** wurden dir gutgeschrieben.`,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // Direct offer/role deny
  if (id.startsWith('trade_deny_direct_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_deny_direct_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht für dich.', ephemeral: true });
    }

    // Bei Coins-Typ: reservierte Coins zurück an den Sender
    if (offer.type === 'coins') {
      await coinService.addCoins(interaction.guild.id, offer.senderId, offer.price, 'trade', `Coins-Überweisung abgelehnt von <@${offer.targetId}>`);
    }

    offer.status = 'denied';
    await offer.save();

    // Benachrichtigung für den Sender
    let notifDesc;
    if (offer.type === 'coins') {
      notifDesc = `❌ <@${offer.targetId}> hat deine Überweisung von **${formatCoins(offer.price)}** abgelehnt. Die Coins wurden zurückerstattet.`;
    } else if (offer.type === 'role') {
      notifDesc = `❌ <@${offer.targetId}> hat dein Rollenangebot **${offer.roleName}** abgelehnt.`;
    } else if (offer.type === 'service') {
      notifDesc = `❌ <@${offer.targetId}> hat deine Anfrage für **${offer.serviceName}** abgelehnt.`;
    } else {
      notifDesc = `❌ <@${offer.targetId}> hat dein Angebot abgelehnt.`;
    }
    await Offer.create({
      guildId: offer.guildId,
      senderId: offer.targetId,
      targetId: offer.senderId,
      type: 'notification',
      description: notifDesc,
    });

    const embed = createEmbed({
      title: '❌ Abgelehnt',
      color: COLORS.ERROR,
      description: offer.type === 'coins'
        ? `Du hast die Überweisung von **${formatCoins(offer.price)}** von <@${offer.senderId}> abgelehnt.`
        : `Du hast das Angebot von <@${offer.senderId}> abgelehnt.`,
    });
    return interaction.update({ embeds: [embed], components: [] });
  }

  // Shop send button - show user select
  if (id === 'shop_send') {
    const { ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const embed = createEmbed({
      title: '📤 Senden',
      description: 'Wähle einen User aus, an den du etwas senden möchtest.',
      color: COLORS.MARKET,
    });
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('shop_send_target')
        .setPlaceholder('User auswählen...')
    );
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Shop send action buttons (coins or offer)
  if (id.startsWith('shop_send_coins_') || id.startsWith('shop_send_offer_')) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const targetId = id.startsWith('shop_send_coins_')
      ? id.replace('shop_send_coins_', '')
      : id.replace('shop_send_offer_', '');

    if (id.startsWith('shop_send_coins_')) {
      const modal = new ModalBuilder()
        .setCustomId(`modal_send_coins_${targetId}`)
        .setTitle('Coins senden');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Betrag')
            .setPlaceholder('z.B. 100')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('message')
            .setLabel('Nachricht (optional)')
            .setPlaceholder('z.B. Danke für die Hilfe!')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
      );
      return interaction.showModal(modal);
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_send_offer_${targetId}`)
      .setTitle('Angebot senden');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Beschreibung')
          .setPlaceholder('Was bietest du an?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('price')
          .setLabel('Preis (Coins)')
          .setPlaceholder('z.B. 500')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
    );
    return interaction.showModal(modal);
  }

  // Shop send role - show own roles as string select
  if (id.startsWith('shop_send_role_')) {
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const targetId = id.replace('shop_send_role_', '');

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const userRoles = member.roles.cache
      .filter(r => r.id !== interaction.guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (userRoles.length === 0) {
      return interaction.reply({ content: '❌ Du besitzt keine Rollen, die du anbieten kannst.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '🏷️ Rolle anbieten',
      description: 'Wähle eine deiner Rollen aus, die du anbieten möchtest.',
      color: COLORS.MARKET,
    });
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_send_role_select_${targetId}`)
      .setPlaceholder('Rolle auswählen...')
      .addOptions(userRoles.map(r => ({
        label: r.name,
        value: r.id,
        emoji: '🏷️',
      })));
    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Shop offers - show pending offers for this user
  if (id === 'shop_offers') {
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

    const offers = await Offer.find({
      guildId: interaction.guild.id,
      targetId: interaction.user.id,
      status: 'pending',
    }).sort({ createdAt: -1 }).limit(25).lean();

    if (offers.length === 0) {
      const embed = createEmbed({
        title: '📬 Dein Postfach',
        description: 'Du hast keine offenen Angebote.',
        color: COLORS.MARKET,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const lines = offers.map((o, i) => {
      if (o.type === 'notification') {
        return `**${i + 1}.** 🔔 ${o.description}`;
      }
      if (o.type === 'role') {
        return `**${i + 1}.** 🏷️ Rolle: **${o.roleName}**\n> Von: <@${o.senderId}> • Preis: ${formatCoins(o.price || 0)}`;
      }
      if (o.type === 'service') {
        return `**${i + 1}.** 🔧 Service-Anfrage: **${o.serviceName}**\n> Von: <@${o.senderId}> • ${formatCoins(o.price || 0)}\n> ${(o.description || '').slice(0, 80)}`;
      }
      if (o.type === 'offer') {
        return `**${i + 1}.** 📋 Angebot von <@${o.senderId}>\n> ${o.description}\n> Preis: ${formatCoins(o.price || 0)}`;
      }
      const msg = o.description ? `\n> 💬 "${o.description}"` : '';
      return `**${i + 1}.** 💰 ${formatCoins(o.price || 0)} von <@${o.senderId}>${msg}`;
    });

    // Benachrichtigungen automatisch als gelesen markieren
    const notifIds = offers.filter(o => o.type === 'notification').map(o => o._id);
    if (notifIds.length > 0) {
      await Offer.updateMany({ _id: { $in: notifIds } }, { status: 'accepted' });
    }

    const actionableOffers = offers.filter(o => o.type !== 'notification');

    const embed = createEmbed({
      title: '📬 Dein Postfach',
      description: lines.join('\n\n'),
      color: COLORS.MARKET,
      footer: actionableOffers.length > 0
        ? `${offers.length} Einträge • Wähle ein Angebot zum Einsehen`
        : `${offers.length} Benachrichtigung${offers.length === 1 ? '' : 'en'}`,
    });

    if (actionableOffers.length === 0) {
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_offer_view')
      .setPlaceholder('Angebot einsehen...')
      .addOptions(actionableOffers.map((o) => {
        let label, desc;
        if (o.type === 'role') {
          label = `🏷️ Rolle: ${o.roleName || 'Unbekannt'}`;
          desc = formatCoins(o.price || 0);
        } else if (o.type === 'service') {
          label = `🔧 ${o.serviceName || 'Service'}`;
          desc = `${formatCoins(o.price || 0)} • ${(o.description || '').slice(0, 30) || 'Anfrage'}`;
        } else if (o.type === 'offer') {
          label = `📋 ${(o.description || 'Angebot').slice(0, 40)}`;
          desc = formatCoins(o.price || 0);
        } else {
          label = `💰 ${formatCoins(o.price || 0)}`;
          desc = 'Coins-Überweisung';
        }
        return { label: label.slice(0, 100), description: desc.slice(0, 100), value: o._id.toString() };
      }));

    const components = [new ActionRowBuilder().addComponents(selectMenu)];
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  }

  // Shop offer detail view with accept/deny
  if (id.startsWith('shop_offer_detail_')) {
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const offerId = id.replace('shop_offer_detail_', '');
    const offer = await Offer.findById(offerId).lean();

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }

    const fields = [{ name: 'Betrag', value: formatCoins(offer.price || 0), inline: true }];
    let title;
    if (offer.type === 'role') {
      title = '🏷️ Rollenangebot';
      fields.unshift({ name: 'Rolle', value: `<@&${offer.roleId}>`, inline: true });
    } else if (offer.type === 'service') {
      title = '🔧 Service-Anfrage';
      fields.unshift({ name: 'Dienstleistung', value: offer.serviceName || 'Unbekannt', inline: true });
      fields.push({ name: 'Nachricht', value: offer.description || '-' });
    } else if (offer.type === 'offer') {
      title = '📋 Angebot';
      fields.unshift({ name: 'Beschreibung', value: offer.description });
    } else if (offer.type === 'coins') {
      title = '💰 Coins-Überweisung';
      if (offer.description) {
        fields.push({ name: 'Nachricht', value: offer.description });
      }
    } else {
      title = '💰 Angebot';
    }

    const embed = createEmbed({
      title,
      color: COLORS.MARKET,
      description: `Von: <@${offer.senderId}>`,
      fields,
    });

    let acceptId;
    if (offer.type === 'role') acceptId = `trade_accept_role_${offer._id}`;
    else if (offer.type === 'service') acceptId = `trade_accept_service_${offer._id}`;
    else acceptId = `trade_accept_direct_${offer._id}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(acceptId)
        .setLabel('Annehmen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_deny_direct_${offer._id}`)
        .setLabel('Ablehnen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Role buy confirmation
  if (id.startsWith('role_confirm_buy_')) {
    const marketService = require('../services/marketService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const roleName = id.replace('role_confirm_buy_', '');

    try {
      const { marketRole, price, roleError } = await marketService.buyRole(
        interaction.guild.id,
        interaction.user.id,
        roleName,
        interaction.guild
      );
      const fields = [
        { name: 'Rolle', value: marketRole.name, inline: true },
        { name: 'Preis', value: formatCoins(price), inline: true },
        { name: 'Verbleibend', value: `${marketRole.totalStock - marketRole.purchased}`, inline: true },
      ];
      if (roleError) {
        fields.push({ name: '⚠️ Hinweis', value: `Rolle konnte nicht zugewiesen werden: ${roleError}` });
      }
      const embed = createEmbed({
        title: roleError ? '⚠️ Rolle gekauft, aber nicht zugewiesen!' : '🎉 Rolle gekauft!',
        color: roleError ? COLORS.WARNING : COLORS.SUCCESS,
        fields,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      return interaction.update({ content: `❌ ${err.message}`, embeds: [], components: [] });
    }
  }

  // Role buy cancel
  if (id === 'role_cancel_buy') {
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const embed = createEmbed({
      title: '❌ Kauf abgebrochen',
      description: 'Du hast den Kauf abgebrochen.',
      color: COLORS.ERROR,
    });
    return interaction.update({ embeds: [embed], components: [] });
  }

  // Quest claim confirmation
  if (id.startsWith('quest_confirm_claim_')) {
    const questService = require('../services/questService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const questId = id.replace('quest_confirm_claim_', '');

    try {
      const { quest, channelId } = await questService.claimQuest(
        interaction.guild.id,
        questId,
        interaction.user.id,
        interaction.guild
      );
      const embed = createEmbed({
        title: '📋 Quest angenommen!',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Quest', value: quest.title, inline: true },
          { name: 'Belohnung', value: formatCoins(quest.reward), inline: true },
        ],
        description: channelId
          ? `Ein Ticket-Channel wurde erstellt: <#${channelId}>`
          : 'Viel Erfolg!',
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      return interaction.update({ content: `❌ ${err.message}`, embeds: [], components: [] });
    }
  }

  // Quest claim cancel
  if (id === 'quest_cancel_claim') {
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const embed = createEmbed({
      title: '❌ Abgebrochen',
      description: 'Du hast die Quest nicht angenommen.',
      color: COLORS.ERROR,
    });
    return interaction.update({ embeds: [embed], components: [] });
  }

  // Job apply confirmation — Ticket erstellen
  if (id.startsWith('job_confirm_apply_')) {
    const JobListing = require('../models/JobListing');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ChannelType, PermissionFlagsBits, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const jobId = id.replace('job_confirm_apply_', '');

    const listing = await JobListing.findById(jobId).lean();
    if (!listing || !listing.isOpen) {
      return interaction.update({ content: '❌ Diese Stelle ist nicht mehr verfügbar.', embeds: [], components: [] });
    }

    const guild = interaction.guild;
    const applicant = await guild.members.fetch(interaction.user.id);
    const applicantName = applicant.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const jobName = listing.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);

    const channel = await guild.channels.create({
      name: `job-${jobName}-${applicantName}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
        { id: applicant.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });

    const roleDisplay = listing.roleId ? `<@&${listing.roleId}>` : 'Keine';
    const ticketEmbed = createEmbed({
      title: `💼 Bewerbung: ${listing.title}`,
      description: listing.description,
      color: COLORS.JOB,
      fields: [
        { name: 'Bewerber', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Gehalt', value: `${formatCoins(listing.salary || 0)}/Woche`, inline: true },
        { name: 'Rolle', value: roleDisplay, inline: true },
      ],
      footer: 'Ein Admin kann diese Bewerbung annehmen oder ablehnen.',
    });

    const ticketButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`job_accept_${listing._id}_${interaction.user.id}_${channel.id}`)
        .setLabel('Annehmen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`job_deny_${listing._id}_${interaction.user.id}_${channel.id}`)
        .setLabel('Ablehnen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [ticketButtons] });

    const confirmEmbed = createEmbed({
      title: '✅ Bewerbung erstellt!',
      description: `Deine Bewerbung für **${listing.title}** wurde erstellt: <#${channel.id}>`,
      color: COLORS.SUCCESS,
    });
    return interaction.update({ embeds: [confirmEmbed], components: [] });
  }

  // Job apply cancel
  if (id === 'job_cancel_apply') {
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const embed = createEmbed({
      title: '❌ Abgebrochen',
      description: 'Du hast dich nicht beworben.',
      color: COLORS.ERROR,
    });
    return interaction.update({ embeds: [embed], components: [] });
  }

  // Shop category navigation
  if (id.startsWith('shop_cat_')) {
    const { buildShopResponse } = require('../services/shopService');
    const category = id.replace('shop_cat_', '');
    const { embed, components } = await buildShopResponse(interaction.guild.id, category, 1);
    return interaction.update({ embeds: [embed], components });
  }

  // Shop pagination
  if (id.startsWith('shop_page_')) {
    const { buildShopResponse } = require('../services/shopService');
    // Format: shop_page_{category}_{pageNum}
    const parts = id.split('_');
    const category = parts[2];
    const page = parseInt(parts[3]);
    if (isNaN(page)) return interaction.deferUpdate();
    const { embed, components } = await buildShopResponse(interaction.guild.id, category, page);
    return interaction.update({ embeds: [embed], components });
  }
}

async function handleSelectMenu(interaction) {
  const id = interaction.customId;

  // Buy role from shop — Bestätigung anzeigen
  if (id.startsWith('shop_buy_role_')) {
    const MarketRole = require('../models/MarketRole');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const roleName = interaction.values[0];

    const role = await MarketRole.findOne({ guildId: interaction.guild.id, name: { $regex: new RegExp(`^${roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).lean();
    if (!role) {
      return interaction.reply({ content: '❌ Diese Rolle existiert nicht mehr.', ephemeral: true });
    }

    const stock = role.totalStock - role.purchased;
    if (stock <= 0) {
      return interaction.reply({ content: '❌ Diese Rolle ist ausverkauft.', ephemeral: true });
    }

    const price = role.isPrestige ? 6000 : role.price;
    const roleDisplay = role.roleId ? `<@&${role.roleId}>` : role.name;
    const embed = createEmbed({
      title: '🏷️ Rolle kaufen?',
      description: `Möchtest du diese Rolle wirklich kaufen?\n\n> ${roleDisplay}\n> 💰 Preis: **${formatCoins(price)}**\n> Verfügbar: ${stock}/${role.totalStock}`,
      color: COLORS.MARKET,
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`role_confirm_buy_${roleName}`)
        .setLabel(`Kaufen (${formatCoins(price)})`)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('role_cancel_buy')
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    return;
  }

  // Buy prestige role
  if (id.startsWith('shop_buy_prestige_')) {
    const marketService = require('../services/marketService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const roleName = interaction.values[0];

    try {
      const { marketRole, price } = await marketService.buyRole(
        interaction.guild.id,
        interaction.user.id,
        roleName,
        interaction.guild
      );
      const embed = createEmbed({
        title: '⭐ Prestige-Rolle gekauft!',
        color: COLORS.GOLD,
        fields: [
          { name: 'Rolle', value: marketRole.name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    return;
  }

  // Request service
  if (id.startsWith('shop_service_request_')) {
    const Service = require('../models/Service');
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const serviceId = interaction.values[0];
    const service = await Service.findById(serviceId).lean();

    if (!service || !service.isActive) {
      return interaction.reply({ content: '❌ Diese Dienstleistung ist nicht mehr verfügbar.', ephemeral: true });
    }

    if (service.providerId === interaction.user.id) {
      return interaction.reply({ content: '❌ Du kannst deine eigene Dienstleistung nicht anfragen.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_service_request_${serviceId}`)
      .setTitle(`${service.name.slice(0, 40)} anfragen`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Was möchtest du konkret?')
          .setPlaceholder('Beschreibe dein Anliegen...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
    );
    return interaction.showModal(modal);
  }

  // Claim quest — Bestätigung anzeigen
  if (id.startsWith('shop_quest_claim_')) {
    const Quest = require('../models/Quest');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const questId = interaction.values[0];

    const quest = await Quest.findOne({ _id: questId, guildId: interaction.guild.id, status: 'open' }).lean();
    if (!quest) {
      return interaction.reply({ content: '❌ Diese Quest ist nicht mehr verfügbar.', ephemeral: true });
    }

    const participants = quest.participants ? quest.participants.length : 0;
    const embed = createEmbed({
      title: '📋 Quest annehmen?',
      description: `Möchtest du diese Quest wirklich annehmen?\n\n> **${quest.title}**\n> ${quest.description}\n> 🏆 Belohnung: **${formatCoins(quest.reward)}**\n> 👥 ${participants} Teilnehmer`,
      color: COLORS.MARKET,
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`quest_confirm_claim_${questId}`)
        .setLabel('Quest annehmen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('quest_cancel_claim')
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    return;
  }

  // Apply for job — Bestätigung anzeigen
  if (id.startsWith('shop_apply_job_')) {
    const JobListing = require('../models/JobListing');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const jobId = interaction.values[0];

    const listing = await JobListing.findById(jobId).lean();
    if (!listing || !listing.isOpen) {
      return interaction.reply({ content: '❌ Diese Stelle ist nicht mehr verfügbar.', ephemeral: true });
    }

    const roleDisplay = listing.roleId ? `<@&${listing.roleId}>` : 'Keine';
    const embed = createEmbed({
      title: '💼 Bewerben?',
      description: `Möchtest du dich wirklich bewerben?\n\n> **${listing.title}**\n> ${listing.description}\n> 💰 Gehalt: **${formatCoins(listing.salary || 0)}/Woche**\n> Rolle: ${roleDisplay}`,
      color: COLORS.JOB,
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`job_confirm_apply_${jobId}`)
        .setLabel('Bewerben')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('job_cancel_apply')
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    return;
  }

  // Offer view from select menu - redirect to detail button handler
  if (id === 'shop_offer_view') {
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const offerId = interaction.values[0];
    const offer = await Offer.findById(offerId).lean();

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }

    const fields = [{ name: 'Betrag', value: formatCoins(offer.price || 0), inline: true }];
    let title;
    if (offer.type === 'role') {
      title = '🏷️ Rollenangebot';
      fields.unshift({ name: 'Rolle', value: `<@&${offer.roleId}>`, inline: true });
    } else if (offer.type === 'service') {
      title = '🔧 Service-Anfrage';
      fields.unshift({ name: 'Dienstleistung', value: offer.serviceName || 'Unbekannt', inline: true });
      fields.push({ name: 'Nachricht', value: offer.description || '-' });
    } else if (offer.type === 'offer') {
      title = '📋 Angebot';
      fields.unshift({ name: 'Beschreibung', value: offer.description });
    } else if (offer.type === 'coins') {
      title = '💰 Coins-Überweisung';
      if (offer.description) {
        fields.push({ name: 'Nachricht', value: offer.description });
      }
    } else {
      title = '💰 Angebot';
    }

    const embed = createEmbed({
      title,
      color: COLORS.MARKET,
      description: `Von: <@${offer.senderId}>`,
      fields,
    });

    let acceptId;
    if (offer.type === 'role') acceptId = `trade_accept_role_${offer._id}`;
    else if (offer.type === 'service') acceptId = `trade_accept_service_${offer._id}`;
    else acceptId = `trade_accept_direct_${offer._id}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(acceptId)
        .setLabel('Annehmen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_deny_direct_${offer._id}`)
        .setLabel('Ablehnen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Role select for sending a role offer (StringSelectMenu)
  if (id.startsWith('shop_send_role_select_')) {
    const targetId = id.replace('shop_send_role_select_', '');
    const roleId = interaction.values[0];
    const role = await interaction.guild.roles.fetch(roleId);

    if (!role) {
      return interaction.reply({ content: '❌ Diese Rolle existiert nicht mehr.', ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_send_role_${targetId}_${roleId}`)
      .setTitle(`Rolle anbieten: ${role.name.slice(0, 30)}`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('price')
          .setLabel('Preis (Coins)')
          .setPlaceholder('z.B. 500')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
    );
    return interaction.showModal(modal);
  }
}

async function handleUserSelectMenu(interaction) {
  const id = interaction.customId;

  if (id === 'shop_send_target') {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const targetUser = interaction.users.first();

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Du kannst nichts an dich selbst senden.', ephemeral: true });
    }
    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Du kannst nichts an Bots senden.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '📤 Senden an ' + targetUser.displayName,
      description: 'Was möchtest du senden?',
      color: COLORS.MARKET,
      thumbnail: targetUser.displayAvatarURL(),
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_send_coins_${targetUser.id}`)
        .setLabel('Coins senden')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`shop_send_offer_${targetUser.id}`)
        .setLabel('Angebot senden')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`shop_send_role_${targetUser.id}`)
        .setLabel('Rolle anbieten')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

async function handleModal(interaction) {
  const id = interaction.customId;

  // Aufleveln
  if (id === 'modal_levelup') {
    const xpService = require('../services/xpService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { LEVEL } = require('../constants');
    const amount = parseInt(interaction.fields.getTextInputValue('amount'));

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Betrag ein.', ephemeral: true });
    }

    try {
      const { user, cost, oldLevel, newLevel } = await xpService.levelUp(interaction.guild.id, interaction.user.id, amount, interaction.guild);
      const levelsGained = newLevel - oldLevel;
      const isMaxLevel = user.level >= LEVEL.MAX_LEVEL;
      const currentRank = await xpService.getRankDisplay(interaction.guild.id, user.level);
      const nextLevelCost = isMaxLevel ? 0 : xpService.costForLevel(user.level + 1);
      const nextRank = isMaxLevel ? null : await xpService.getRankDisplay(interaction.guild.id, user.level + 1);

      let statusLine;
      if (levelsGained > 0) {
        const oldRank = await xpService.getRankDisplay(interaction.guild.id, oldLevel);
        statusLine = `⬆️ **Aufgestiegen!** ${oldLevel > 0 ? oldRank : 'Kein Rang'} → ${currentRank}`;
      } else {
        statusLine = `💰 **${formatCoins(cost)}** eingezahlt!`;
      }

      const Offer = require('../models/Offer');
      const pendingCount = await Offer.countDocuments({ guildId: interaction.guild.id, targetId: interaction.user.id, status: 'pending' });

      const fields = [
        { name: 'Rang', value: user.level > 0 ? currentRank : 'Kein Rang', inline: true },
        { name: 'Nächster Rang', value: isMaxLevel ? 'Max erreicht' : `${nextRank} — ${formatCoins(user.levelProgress || 0)}/${formatCoins(nextLevelCost)}`, inline: true },
      ];
      if (pendingCount > 0) {
        fields.push({ name: '📬 Postfach', value: `**${pendingCount}** neue Meldung${pendingCount > 1 ? 'en' : ''}`, inline: true });
      }

      const embed = createEmbed({
        title: '💰 Dein Kontostand',
        description: `${statusLine}\n\nDu hast **${formatCoins(user.coins)}**`,
        color: COLORS.GOLD,
        thumbnail: interaction.user.displayAvatarURL(),
        fields,
      });

      const buttons = [];
      if (!isMaxLevel) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId('shop_levelup')
            .setLabel('Aufleveln')
            .setEmoji('⬆️')
            .setStyle(ButtonStyle.Primary),
        );
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId('shop_send')
          .setLabel('Senden')
          .setEmoji('📤')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('shop_offers')
          .setLabel(pendingCount > 0 ? `Postfach (${pendingCount})` : 'Postfach')
          .setEmoji('📬')
          .setStyle(ButtonStyle.Secondary),
      );

      const components = [new ActionRowBuilder().addComponents(buttons)];
      return interaction.reply({ embeds: [embed], components, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // Coins senden — Angebot erstellen
  if (id.startsWith('modal_send_coins_')) {
    const coinService = require('../services/coinService');
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const targetId = id.replace('modal_send_coins_', '');
    const amount = parseInt(interaction.fields.getTextInputValue('amount'));
    const message = interaction.fields.getTextInputValue('message') || '';

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Betrag ein.', ephemeral: true });
    }

    // Prüfen ob der Sender genug Coins hat
    const sender = await coinService.getBalance(interaction.guild.id, interaction.user.id);
    if (sender < amount) {
      return interaction.reply({ content: `❌ Du hast nicht genug Coins. Dein Guthaben: ${formatCoins(sender)}`, ephemeral: true });
    }

    // Coins vom Sender abziehen (reservieren)
    await coinService.addCoins(interaction.guild.id, interaction.user.id, -amount, 'trade', `Coins reserviert für <@${targetId}>`);

    await Offer.create({
      guildId: interaction.guild.id,
      senderId: interaction.user.id,
      targetId,
      type: 'coins',
      price: amount,
      description: message || null,
    });

    const msgInfo = message ? `\n> 💬 "${message}"` : '';
    const embed = createEmbed({
      title: '✅ Coins-Überweisung erstellt!',
      color: COLORS.SUCCESS,
      description: `**${formatCoins(amount)}** wurden für <@${targetId}> reserviert.${msgInfo}\n\nDer Empfänger muss die Überweisung im Postfach akzeptieren.`,
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Rolle anbieten
  if (id.startsWith('modal_send_role_')) {
    const Offer = require('../models/Offer');
    // Format: modal_send_role_{targetId}_{roleId}
    const parts = id.split('_');
    const targetId = parts[3];
    const roleId = parts[4];
    const price = parseInt(interaction.fields.getTextInputValue('price'));

    if (isNaN(price) || price <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Preis ein.', ephemeral: true });
    }

    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) {
      return interaction.reply({ content: '❌ Diese Rolle existiert nicht mehr.', ephemeral: true });
    }

    await Offer.create({
      guildId: interaction.guild.id,
      senderId: interaction.user.id,
      targetId,
      type: 'role',
      price,
      roleId,
      roleName: role.name,
    });

    return interaction.reply({
      content: `✅ Rollenangebot für **${role.name}** an <@${targetId}> gesendet! Der User kann es unter 📬 Postfach einsehen.`,
      ephemeral: true,
    });
  }

  // Angebot senden
  if (id.startsWith('modal_send_offer_')) {
    const Offer = require('../models/Offer');
    const targetId = id.replace('modal_send_offer_', '');
    const description = interaction.fields.getTextInputValue('description');
    const price = parseInt(interaction.fields.getTextInputValue('price'));

    if (isNaN(price) || price <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Preis ein.', ephemeral: true });
    }

    await Offer.create({
      guildId: interaction.guild.id,
      senderId: interaction.user.id,
      targetId,
      type: 'offer',
      description,
      price,
    });

    return interaction.reply({
      content: `✅ Angebot an <@${targetId}> gesendet! Der User kann es unter 📬 Postfach einsehen.`,
      ephemeral: true,
    });
  }

  // Service anfragen — Ticket erstellen
  if (id.startsWith('modal_service_request_')) {
    const Service = require('../models/Service');
    const { formatCoins } = require('../utils/formatters');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { ChannelType, PermissionFlagsBits, OverwriteType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const serviceId = id.replace('modal_service_request_', '');
    const message = interaction.fields.getTextInputValue('message');

    const service = await Service.findById(serviceId).lean();
    if (!service || !service.isActive) {
      return interaction.reply({ content: '❌ Diese Dienstleistung ist nicht mehr verfügbar.', ephemeral: true });
    }

    const guild = interaction.guild;
    const requesterMember = await guild.members.fetch(interaction.user.id);
    const providerMember = await guild.members.fetch(service.providerId);
    const requesterName = requesterMember.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const serviceName = service.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);

    const channel = await guild.channels.create({
      name: `service-${serviceName}-${requesterName}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
        { id: requesterMember.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: providerMember.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });

    const embed = createEmbed({
      title: `🔧 Dienstleistung: ${service.name}`,
      description: `${service.description}\n\n**Nachricht von <@${interaction.user.id}>:**\n> ${message}`,
      color: COLORS.MARKET,
      fields: [
        { name: 'Anfrage von', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Anbieter', value: `<@${service.providerId}>`, inline: true },
        { name: 'Preis', value: formatCoins(service.price), inline: true },
      ],
      footer: 'Der Anbieter kann die Anfrage annehmen oder ablehnen.',
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`service_accept_${serviceId}_${interaction.user.id}_${channel.id}`)
        .setLabel('Annehmen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`service_deny_${serviceId}_${interaction.user.id}_${channel.id}`)
        .setLabel('Ablehnen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    await channel.send({ content: `<@${interaction.user.id}> <@${service.providerId}>`, embeds: [embed], components: [buttons] });

    return interaction.reply({
      content: `✅ Ticket für **${service.name}** erstellt: <#${channel.id}>`,
      ephemeral: true,
    });
  }
}
