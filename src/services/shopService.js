const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const marketService = require('./marketService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins } = require('../utils/formatters');
const Service = require('../models/Service');
const Quest = require('../models/Quest');
const JobListing = require('../models/JobListing');

const CATEGORIES = [
  { id: 'roles',    label: 'Rollen',    emoji: '🏷️' },
  { id: 'services', label: 'Services',  emoji: '🔧' },
  { id: 'quests',   label: 'Quests',    emoji: '📋' },
  { id: 'prestige', label: 'Prestige',  emoji: '⭐' },
  { id: 'jobs',     label: 'Jobs',      emoji: '💼' },
];

const PER_PAGE = 5;

function buildCategoryRow(activeCategory) {
  return new ActionRowBuilder().addComponents(
    CATEGORIES.map(cat =>
      new ButtonBuilder()
        .setCustomId(`shop_cat_${cat.id}`)
        .setLabel(cat.label)
        .setEmoji(cat.emoji)
        .setStyle(cat.id === activeCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
}

function buildPaginationRow(category, currentPage, totalPages) {
  if (totalPages <= 1) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_page_${category}_${currentPage - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`shop_page_${category}_info`)
      .setLabel(`${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`shop_page_${category}_${currentPage + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
  );
}

// ── Rollen ──

async function renderRolesPage(guildId, page = 1) {
  const { roles, totalPages } = await marketService.getShopRoles(guildId, page, PER_PAGE);

  if (roles.length === 0) {
    const embed = createEmbed({
      title: '🏷️ Rollen-Shop',
      description: 'Keine Rollen verfügbar.',
      color: COLORS.MARKET,
    });
    return { embed, components: [buildCategoryRow('roles')], totalPages: 1 };
  }

  const lines = roles.map((r, i) => {
    const stock = r.totalStock - r.purchased;
    const tag = r.isPrestige ? ' ⭐' : '';
    const status = stock > 0 ? `${stock}/${r.totalStock}` : '❌ Ausverkauft';
    return `**${i + 1}.** ${r.name}${tag}\n> 💰 ${formatCoins(r.price)} • Verfügbar: ${status}`;
  });

  const embed = createEmbed({
    title: '🏷️ Rollen-Shop',
    description: lines.join('\n\n'),
    color: COLORS.MARKET,
    footer: `Seite ${page}/${totalPages} • Wähle eine Rolle zum Kaufen`,
  });

  const components = [buildCategoryRow('roles')];
  const pagination = buildPaginationRow('roles', page, totalPages);
  if (pagination) components.push(pagination);

  if (roles.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_buy_role_${page}`)
      .setPlaceholder('Rolle zum Kaufen auswählen...')
      .addOptions(
        roles
          .filter(r => (r.totalStock - r.purchased) > 0)
          .slice(0, 25)
          .map(r => ({
            label: r.name,
            description: `${formatCoins(r.isPrestige ? 6000 : r.price)} • ${r.totalStock - r.purchased} verfügbar`,
            value: r.name,
            emoji: r.isPrestige ? '⭐' : '🏷️',
          }))
      );
    if (selectMenu.options.length > 0) {
      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }
  }

  return { embed, components, totalPages };
}

// ── Services ──

async function renderServicesPage(guildId, page = 1) {
  const skip = (page - 1) * PER_PAGE;
  const filter = { guildId, isActive: true };
  const services = await Service.find(filter).sort({ createdAt: -1 }).skip(skip).limit(PER_PAGE).lean();
  const total = await Service.countDocuments(filter);
  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  if (services.length === 0) {
    const embed = createEmbed({
      title: '🔧 Dienstleistungen',
      description: 'Keine Dienstleistungen verfügbar.\n\n> Kontaktiere einen Admin, um deine Dienste anzubieten!',
      color: COLORS.MARKET,
    });
    return { embed, components: [buildCategoryRow('services')], totalPages: 1 };
  }

  const lines = services.map((s, i) =>
    `**${i + 1}.** ${s.name}\n> ${s.description}\n> 💰 ${formatCoins(s.price)} • Anbieter: <@${s.providerId}>`
  );

  const embed = createEmbed({
    title: '🔧 Dienstleistungen',
    description: lines.join('\n\n'),
    color: COLORS.MARKET,
    footer: `Seite ${page}/${totalPages}`,
  });

  const components = [buildCategoryRow('services')];
  const pagination = buildPaginationRow('services', page, totalPages);
  if (pagination) components.push(pagination);

  return { embed, components, totalPages };
}

// ── Quests ──

async function renderQuestsPage(guildId, page = 1) {
  const skip = (page - 1) * PER_PAGE;
  const filter = { guildId, status: 'open' };
  const quests = await Quest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(PER_PAGE).lean();
  const total = await Quest.countDocuments(filter);
  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  if (quests.length === 0) {
    const embed = createEmbed({
      title: '📋 Questboard',
      description: 'Keine offenen Quests verfügbar.\n\n> Neue Quests werden von Admins erstellt.',
      color: COLORS.MARKET,
    });
    return { embed, components: [buildCategoryRow('quests')], totalPages: 1 };
  }

  const lines = quests.map((q, i) => {
    const participants = q.participants ? q.participants.length : 0;
    return `**${i + 1}.** ${q.title}\n> ${q.description}\n> 🏆 Belohnung: ${formatCoins(q.reward)} • 👥 ${participants} Teilnehmer`;
  });

  const embed = createEmbed({
    title: '📋 Questboard',
    description: lines.join('\n\n'),
    color: COLORS.MARKET,
    footer: `Seite ${page}/${totalPages} • Wähle eine Quest zum Annehmen`,
  });

  const components = [buildCategoryRow('quests')];
  const pagination = buildPaginationRow('quests', page, totalPages);
  if (pagination) components.push(pagination);

  if (quests.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_quest_claim_${page}`)
      .setPlaceholder('Quest annehmen...')
      .addOptions(
        quests.slice(0, 25).map(q => ({
          label: q.title,
          description: `Belohnung: ${formatCoins(q.reward)}`,
          value: q._id.toString(),
          emoji: '📋',
        }))
      );
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  return { embed, components, totalPages };
}

// ── Prestige ──

async function renderPrestigePage(guildId, page = 1) {
  const { roles, totalPages } = await marketService.getPrestigeRoles(guildId, page, PER_PAGE);

  if (roles.length === 0) {
    const embed = createEmbed({
      title: '⭐ Prestige-Shop',
      description: 'Keine Prestige-Rollen verfügbar.',
      color: COLORS.GOLD,
    });
    return { embed, components: [buildCategoryRow('prestige')], totalPages: 1 };
  }

  const lines = roles.map((r, i) => {
    const stock = r.totalStock - r.purchased;
    const status = stock > 0 ? `${stock}/${r.totalStock}` : '❌ Ausverkauft';
    return `**${i + 1}.** ⭐ ${r.name}\n> 💰 ${formatCoins(6000)} • Verfügbar: ${status}`;
  });

  const embed = createEmbed({
    title: '⭐ Prestige-Shop',
    description: lines.join('\n\n'),
    color: COLORS.GOLD,
    footer: `Seite ${page}/${totalPages} • Wähle eine Prestige-Rolle`,
  });

  const components = [buildCategoryRow('prestige')];
  const pagination = buildPaginationRow('prestige', page, totalPages);
  if (pagination) components.push(pagination);

  if (roles.length > 0) {
    const available = roles.filter(r => (r.totalStock - r.purchased) > 0);
    if (available.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`shop_buy_prestige_${page}`)
        .setPlaceholder('Prestige-Rolle kaufen...')
        .addOptions(
          available.slice(0, 25).map(r => ({
            label: r.name,
            description: `${formatCoins(6000)} • ${r.totalStock - r.purchased} verfügbar`,
            value: r.name,
            emoji: '⭐',
          }))
        );
      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }
  }

  return { embed, components, totalPages };
}

// ── Stellenangebote ──

async function renderJobsPage(guildId, page = 1) {
  const skip = (page - 1) * PER_PAGE;
  const filter = { guildId, isOpen: true };
  const listings = await JobListing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(PER_PAGE).lean();
  const total = await JobListing.countDocuments(filter);
  const totalPages = Math.ceil(total / PER_PAGE) || 1;

  if (listings.length === 0) {
    const embed = createEmbed({
      title: '💼 Stellenangebote',
      description: 'Keine offenen Stellen verfügbar.\n\n> Schau später nochmal vorbei!',
      color: COLORS.JOB,
    });
    return { embed, components: [buildCategoryRow('jobs')], totalPages: 1 };
  }

  const lines = listings.map((j, i) =>
    `**${i + 1}.** ${j.title}\n> ${j.description}\n> 📂 Typ: ${j.type}`
  );

  const embed = createEmbed({
    title: '💼 Stellenangebote',
    description: lines.join('\n\n'),
    color: COLORS.JOB,
    footer: `Seite ${page}/${totalPages} • Wähle eine Stelle zum Bewerben`,
  });

  const components = [buildCategoryRow('jobs')];
  const pagination = buildPaginationRow('jobs', page, totalPages);
  if (pagination) components.push(pagination);

  if (listings.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_apply_job_${page}`)
      .setPlaceholder('Stelle auswählen...')
      .addOptions(
        listings.slice(0, 25).map(j => ({
          label: j.title,
          description: j.type,
          value: j._id.toString(),
          emoji: '💼',
        }))
      );
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  return { embed, components, totalPages };
}

// ── Dispatcher ──

const renderers = {
  roles:    renderRolesPage,
  services: renderServicesPage,
  quests:   renderQuestsPage,
  prestige: renderPrestigePage,
  jobs:     renderJobsPage,
};

async function buildShopResponse(guildId, category = 'roles', page = 1) {
  const renderer = renderers[category];
  const result = renderer ? await renderer(guildId, page) : await renderers.roles(guildId, 1);
  return result;
}

module.exports = { buildShopResponse, CATEGORIES };
