import { pmsUrl } from './client';
import type { Stream } from './types';

// Text formats we can convert to WebVTT in the browser. Image subs (PGS, VobSub) still get burned in.
const TEXT_CODECS = new Set(['srt', 'subrip', 'ass', 'ssa', 'webvtt', 'vtt', 'mov_text', 'tx3g', 'text']);

export function isTextSubtitle(s: Stream): boolean {
	return TEXT_CODECS.has((s.codec ?? '').toLowerCase());
}

const cache = new Map<number, string>();

/**
 * Download a subtitle stream (external file or embedded track) and return a blob: URL
 * to a WebVTT version for a <track> element.
 */
export async function loadSubtitleVtt(s: Stream): Promise<string> {
	const hit = cache.get(s.id);
	if (hit) return hit;
	const res = await fetch(pmsUrl(s.key ?? `/library/streams/${s.id}`));
	if (!res.ok) throw new Error(`Subtitle download failed (${res.status})`);
	const vtt = toVtt(decode(await res.arrayBuffer()));
	const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
	cache.set(s.id, url);
	return url;
}

// Most subs are UTF-8, but older SRTs are often Windows-1252 (æøå etc.).
function decode(buf: ArrayBuffer): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buf);
	} catch {
		return new TextDecoder('windows-1252').decode(buf);
	}
}

export function toVtt(raw: string): string {
	const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
	if (/^WEBVTT/.test(text)) return text;
	const cues = /^\[Script Info\]/im.test(text) || /^Dialogue:/m.test(text) ? fromAss(text) : fromSrt(text);
	if (!cues.length) throw new Error('No subtitle cues found');
	return (
		'WEBVTT\n\n' +
		cues.map((c) => `${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}`).join('\n\n') +
		'\n'
	);
}

interface Cue {
	start: number;
	end: number;
	text: string;
}

function timestamp(seconds: number): string {
	const ms = Math.max(0, Math.round(seconds * 1000));
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor(ms / 60_000) % 60;
	const s = Math.floor(ms / 1000) % 60;
	const pad = (n: number, w = 2) => String(n).padStart(w, '0');
	return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** "01:02:03,456", "01:02:03.456" or "1:02:03.45" → seconds */
function parseTime(t: string): number {
	const [hms, frac = '0'] = t.trim().split(/[,.]/);
	const parts = hms.split(':').map(Number);
	while (parts.length < 3) parts.unshift(0);
	const [h, m, s] = parts;
	return h * 3600 + m * 60 + s + Number(`0.${frac}`);
}

// VTT understands <i>, <b>, <u>; drop everything else (<font>, {\an8} etc.) and escape the rest.
function cleanMarkup(text: string): string {
	return text
		.replace(/\{\\[^}]*\}/g, '')
		.replace(/<(?!\/?[ibu]>)[^>]*>/gi, '')
		.replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;')
		.trim();
}

function fromSrt(text: string): Cue[] {
	const cues: Cue[] = [];
	for (const block of text.split(/\n{2,}/)) {
		const lines = block.split('\n');
		const i = lines.findIndex((l) => l.includes('-->'));
		if (i < 0) continue;
		const [from, to] = lines[i].split('-->');
		const body = cleanMarkup(lines.slice(i + 1).join('\n'));
		if (body) cues.push({ start: parseTime(from), end: parseTime(to.trim().split(/\s/)[0]), text: body });
	}
	return cues;
}

function fromAss(text: string): Cue[] {
	const events = text.split(/^\[Events\]/im)[1] ?? text;
	const format = events.match(/^Format:(.*)$/m)?.[1].split(',').map((f) => f.trim().toLowerCase()) ?? [
		'layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'
	];
	const iStart = format.indexOf('start');
	const iEnd = format.indexOf('end');
	const cues: Cue[] = [];
	for (const line of events.split('\n')) {
		if (!line.startsWith('Dialogue:')) continue;
		const fields = line.slice('Dialogue:'.length).split(',');
		// Text is the last field and may itself contain commas.
		const body = fields.slice(format.length - 1).join(',');
		const clean = cleanMarkup(body.replace(/\\N/gi, '\n').replace(/\\h/g, ' '));
		if (clean) cues.push({ start: parseTime(fields[iStart]), end: parseTime(fields[iEnd]), text: clean });
	}
	return cues.sort((a, b) => a.start - b.start);
}
