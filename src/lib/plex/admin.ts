// Server-owner endpoints behind the /admin page. Shapes are what PMS returns as JSON;
// every field is optional because Plex omits empty ones.
import { pms, pmsRaw } from './client';
import type { Metadata } from './types';

// ---------- Now playing ----------

export interface SessionUser {
	id?: string;
	title?: string;
	thumb?: string;
}

export interface SessionPlayer {
	title?: string;
	product?: string;
	platform?: string;
	device?: string;
	state?: 'playing' | 'paused' | 'buffering' | (string & {});
	address?: string;
	local?: boolean;
	relayed?: boolean;
	secure?: boolean;
}

export interface SessionTranscode {
	videoDecision?: string;
	audioDecision?: string;
	subtitleDecision?: string;
	speed?: number;
	throttled?: boolean;
	progress?: number;
	transcodeHwDecoding?: string;
	transcodeHwEncoding?: string;
	videoCodec?: string;
	audioCodec?: string;
	width?: number;
	height?: number;
}

export interface PlaybackSession extends Metadata {
	sessionKey?: string;
	User?: SessionUser;
	Player?: SessionPlayer;
	Session?: { id: string; bandwidth?: number; location?: 'lan' | 'wan' | (string & {}) };
	TranscodeSession?: SessionTranscode;
}

export async function getSessions(): Promise<PlaybackSession[]> {
	const mc = await pms<{ Metadata?: PlaybackSession[] }>('/status/sessions');
	return mc.Metadata ?? [];
}

export function terminateSession(sessionId: string, reason: string) {
	return pms('/status/sessions/terminate', { query: { sessionId, reason } });
}

// ---------- Libraries & background activity ----------

export interface AdminSection {
	key: string;
	title: string;
	type: string;
	agent?: string;
	scanner?: string;
	refreshing?: boolean;
	scannedAt?: number;
	updatedAt?: number;
	Location?: { id: number; path: string }[];
}

export async function getAllSections(): Promise<AdminSection[]> {
	return (await pms<{ Directory?: AdminSection[] }>('/library/sections')).Directory ?? [];
}

export async function getSectionCount(key: string): Promise<number> {
	const mc = await pms(`/library/sections/${key}/all`, {
		query: { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 }
	});
	return mc.totalSize ?? mc.size ?? 0;
}

/** Scan for new/removed files; `force` also re-downloads metadata for everything. */
export function scanSection(key: string | 'all', force = false) {
	return pms(`/library/sections/${key}/refresh`, { query: { force: force ? 1 : undefined } });
}

export function cancelScan(key: string) {
	return pms(`/library/sections/${key}/refresh`, { method: 'DELETE' });
}

export function emptyTrash(key: string) {
	return pms(`/library/sections/${key}/emptyTrash`, { method: 'PUT' });
}

export function cleanBundles() {
	return pms('/library/clean/bundles', { method: 'PUT' });
}

export function optimizeDatabase() {
	return pms('/library/optimize', { method: 'PUT', query: { async: 1 } });
}

export interface Activity {
	uuid: string;
	type: string;
	title?: string;
	subtitle?: string;
	progress?: number;
	cancellable?: boolean;
}

export async function getActivities(): Promise<Activity[]> {
	return (await pms<{ Activity?: Activity[] }>('/activities')).Activity ?? [];
}

export function cancelActivity(uuid: string) {
	return pms(`/activities/${uuid}`, { method: 'DELETE' });
}

// ---------- Server health ----------

export interface ServerInfo {
	friendlyName?: string;
	version?: string;
	platform?: string;
	platformVersion?: string;
	myPlexUsername?: string;
	myPlexSigninState?: string;
	transcoderActiveVideoSessions?: number;
	updatedAt?: number;
}

export function getServerInfo(): Promise<ServerInfo> {
	return pms<ServerInfo>('/');
}

export interface ResourceSample {
	at: number;
	hostCpuUtilization?: number;
	processCpuUtilization?: number;
	hostMemoryUtilization?: number;
	processMemoryUtilization?: number;
}

/** Recent CPU/memory samples (timespan 6 = the dashboard's ~6 s resolution). */
export async function getResources(): Promise<ResourceSample[]> {
	const mc = await pms<{ StatisticsResources?: ResourceSample[] }>('/statistics/resources', {
		query: { timespan: 6 }
	});
	return mc.StatisticsResources ?? [];
}

export interface BandwidthSample {
	at: number;
	lan?: boolean;
	bytes: number;
	timespan?: number;
	accountID?: number;
	deviceID?: number;
}

export async function getBandwidth(): Promise<BandwidthSample[]> {
	const mc = await pms<{ StatisticsBandwidth?: BandwidthSample[] }>('/statistics/bandwidth', {
		query: { timespan: 6 }
	});
	return mc.StatisticsBandwidth ?? [];
}

export interface ButlerTask {
	name: string;
	title?: string;
	description?: string;
	enabled?: boolean;
	interval?: number;
	scheduleRandomized?: boolean;
}

/** Scheduled maintenance tasks. Note /butler is not wrapped in a MediaContainer. */
export async function getButlerTasks(): Promise<ButlerTask[]> {
	const body = await pmsRaw<{ ButlerTasks?: { ButlerTask?: ButlerTask[] } }>('/butler');
	return body.ButlerTasks?.ButlerTask ?? [];
}

export function runButlerTask(name: string) {
	return pms(`/butler/${name}`, { method: 'POST' });
}

// ---------- Watch history ----------

export interface HistoryItem extends Metadata {
	historyKey: string;
	viewedAt: number;
	accountID?: number;
	deviceID?: number;
	librarySectionID?: string;
}

export interface Account {
	id: number;
	name?: string;
	thumb?: string;
}

export interface Device {
	id: number;
	name?: string;
	platform?: string;
}

export async function getHistory(opts: {
	start: number;
	size: number;
	accountID?: number;
	librarySectionID?: string;
}): Promise<{ items: HistoryItem[]; total: number }> {
	const mc = await pms<{ Metadata?: HistoryItem[]; totalSize?: number; size?: number }>(
		'/status/sessions/history/all',
		{
			query: {
				sort: 'viewedAt:desc',
				accountID: opts.accountID,
				librarySectionID: opts.librarySectionID,
				'X-Plex-Container-Start': opts.start,
				'X-Plex-Container-Size': opts.size
			}
		}
	);
	return { items: mc.Metadata ?? [], total: mc.totalSize ?? mc.size ?? 0 };
}

export async function getAccounts(): Promise<Account[]> {
	return (await pms<{ Account?: Account[] }>('/accounts')).Account ?? [];
}

export async function getDevices(): Promise<Device[]> {
	return (await pms<{ Device?: Device[] }>('/devices')).Device ?? [];
}

// ---------- helpers ----------

/** "3 min ago", "2 h ago", "4 d ago" from a unix timestamp (seconds). */
export function ago(unix: number | undefined): string {
	if (!unix) return 'never';
	const s = Math.max(0, Date.now() / 1000 - unix);
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
	if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
	return new Date(unix * 1000).toLocaleDateString();
}
