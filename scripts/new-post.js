#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = path.resolve('_drafts');
const BLOG_DIR = path.resolve('src/content/blog');
const ASSETS_DIR = path.resolve('src/assets/blog');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
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

// Build filenames
const mdxFilename = `${slug}.mdx`;
const imageExt = path.extname(imageFile).toLowerCase();
const imageFilename = `${slug}${imageExt}`;

// Guard against overwriting an existing post
const mdxPath = path.join(BLOG_DIR, mdxFilename);
if (fs.existsSync(mdxPath)) {
  console.error(`Post already exists: src/content/blog/${mdxFilename}`);
  console.error('Rename the draft file or change the # heading to avoid a collision.');
  process.exit(1);
}

// Format pubDate
const pubDate = formatPubDate(new Date());

// Build frontmatter
const frontmatter = `---
title: '${title.replace(/'/g, "\\'")}'
pubDate: '${pubDate}'
description: ''
heroImage: '../../assets/blog/${imageFilename}'
---`;

const mdxContent = `${frontmatter}\n\n${body}`;

// Write MDX file
fs.writeFileSync(mdxPath, mdxContent);

// Copy image to assets
const imageSrc = path.join(DRAFTS_DIR, imageFile);
const imageDest = path.join(ASSETS_DIR, imageFilename);
fs.copyFileSync(imageSrc, imageDest);

// Remove drafts files
fs.unlinkSync(mdPath);
fs.unlinkSync(imageSrc);

console.log(`Created: src/content/blog/${mdxFilename}`);
console.log(`Image:   src/assets/blog/${imageFilename}`);
