#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = path.resolve('_drafts');
const SHORTS_DIR = path.resolve('src/content/shorts');
const ASSETS_DIR = path.resolve('src/assets/shorts');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function getDatePrefix() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getNextLetter(datePrefix, slug) {
  const existing = fs.readdirSync(SHORTS_DIR);
  const letters = existing
    .filter(f => f.startsWith(datePrefix))
    .map(f => f[datePrefix.length])
    .filter(c => /[a-z]/.test(c))
    .sort();
  const next = letters.length === 0 ? 'a' : String.fromCharCode(letters[letters.length - 1].charCodeAt(0) + 1);
  return next;
}

function formatPubDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).replace(',', '');
}

// Find files in _drafts
const draftsFiles = fs.readdirSync(DRAFTS_DIR).filter(f => !f.startsWith('.'));
const mdFile = draftsFiles.find(f => f.endsWith('.md'));
const imageFile = draftsFiles.find(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

if (!mdFile) {
  console.error('No .md file found in _drafts/');
  process.exit(1);
}
if (!imageFile) {
  console.error('No image file found in _drafts/');
  process.exit(1);
}

// Read markdown
const mdPath = path.join(DRAFTS_DIR, mdFile);
const rawContent = fs.readFileSync(mdPath, 'utf-8');

// Extract title from first # heading
const titleMatch = rawContent.match(/^#\s+(.+)$/m);
if (!titleMatch) {
  console.error('No # heading found in markdown file.');
  process.exit(1);
}
const title = titleMatch[1].trim();
const slug = slugify(title);

// Strip the title line from body
const body = rawContent.replace(/^#\s+.+\n?/m, '').trimStart();

// Build filename parts
const datePrefix = getDatePrefix();
const letter = getNextLetter(datePrefix, slug);
const fileBase = `${datePrefix}${letter}`;
const mdxFilename = `${fileBase}-${slug}.mdx`;
const imageExt = path.extname(imageFile).toLowerCase();
const imageFilename = `${fileBase}${imageExt}`;

// Format pubDate
const pubDate = formatPubDate(new Date());

// Build frontmatter
const frontmatter = `---
title: '${title.replace(/'/g, "\\'")}'
pubDate: '${pubDate}'
description: ''
heroImage: '../../assets/shorts/${imageFilename}'
---`;

const mdxContent = `${frontmatter}\n\n${body}`;

// Write MDX file
const mdxPath = path.join(SHORTS_DIR, mdxFilename);
fs.writeFileSync(mdxPath, mdxContent);

// Copy image to assets
const imageSrc = path.join(DRAFTS_DIR, imageFile);
const imageDest = path.join(ASSETS_DIR, imageFilename);
fs.copyFileSync(imageSrc, imageDest);

// Remove drafts files
fs.unlinkSync(mdPath);
fs.unlinkSync(imageSrc);

console.log(`Created: src/content/shorts/${mdxFilename}`);
console.log(`Image:   src/assets/shorts/${imageFilename}`);
