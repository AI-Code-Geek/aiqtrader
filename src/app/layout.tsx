import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "TradeAIQ",
	description: "Watchlist reports dashboard — decisions, confluence and charts.",
};

/** Apply saved theme before paint to avoid a flash. */
const themeScript = `try{var t=localStorage.getItem('aiq_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		// themeScript sets data-theme on <html> before hydration, so the server markup (no data-theme)
		// intentionally differs from the client — suppress the expected attribute mismatch on <html>.
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
		</html>
	);
}
