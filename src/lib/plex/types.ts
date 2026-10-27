export interface PlexUser {
	id: number;
	uuid: string;
	username: string;
	title: string;
	email?: string;
	thumb?: string;
}

export interface Connection {
	protocol: 'http' | 'https';
	address: string;
	port: number;
	uri: string;
	local: boolean;
	relay: boolean;
	IPv6: boolean;
}

/** A device from plex.tv /resources. */
export interface Resource {
	name: string;
	clientIdentifier: string;
	accessToken?: string;
	owned: boolean;
	presence: boolean;
	provides: string;
	productVersion?: string;
	sourceTitle?: string;
	connections: Connection[];
}

/** The server we picked and the connection that answered. */
export interface ServerConn {
	name: string;
	clientIdentifier: string;
	uri: string;
	token: string;
	owned: boolean;
	local: boolean;
	relay: boolean;
}

export interface Tag {
	id?: number;
	tag: string;
	role?: string;
	thumb?: string;
}

export interface Stream {
	id: number;
	/** 1 = video, 2 = audio, 3 = subtitle */
	streamType: 1 | 2 | 3;
	codec?: string;
	displayTitle?: string;
	extendedDisplayTitle?: string;
	language?: string;
	selected?: boolean;
	default?: boolean;
}

export interface Part {
	id: number;
	key: string;
	duration?: number;
	container?: string;
	Stream?: Stream[];
}

export interface Media {
	id: number;
	container?: string;
	videoCodec?: string;
	audioCodec?: string;
	videoResolution?: string;
	bitrate?: number;
	width?: number;
	height?: number;
	Part: Part[];
}

export type ItemType = 'movie' | 'show' | 'season' | 'episode' | 'clip' | (string & {});

export interface Metadata {
	ratingKey: string;
	key: string;
	type: ItemType;
	title: string;
	titleSort?: string;
	summary?: string;
	tagline?: string;
	year?: number;
	studio?: string;
	contentRating?: string;
	rating?: number;
	audienceRating?: number;
	originallyAvailableAt?: string;
	thumb?: string;
	art?: string;
	duration?: number;
	viewOffset?: number;
	viewCount?: number;
	addedAt?: number;

	index?: number;
	parentIndex?: number;
	parentTitle?: string;
	parentRatingKey?: string;
	parentThumb?: string;
	grandparentTitle?: string;
	grandparentRatingKey?: string;
	grandparentThumb?: string;
	grandparentArt?: string;

	leafCount?: number;
	viewedLeafCount?: number;
	childCount?: number;

	Genre?: Tag[];
	Role?: Tag[];
	Director?: Tag[];
	Media?: Media[];
	OnDeck?: { Metadata?: Metadata[] };
}

export interface Hub {
	hubIdentifier: string;
	title: string;
	type: string;
	size: number;
	key?: string;
	more?: boolean;
	Metadata?: Metadata[];
}

export interface Section {
	key: string;
	title: string;
	type: string;
	art?: string;
	thumb?: string;
}

export interface MediaContainer {
	size?: number;
	totalSize?: number;
	offset?: number;
	title1?: string;
	title2?: string;
	Metadata?: Metadata[];
	Directory?: Section[];
	Hub?: Hub[];
}
