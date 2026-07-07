import type { Metadata, Viewport } from "next";
import { Fraunces, Open_Sans, IBM_Plex_Mono, Poppins } from "next/font/google";
import "./globals.css";
// Hoja de estilos original como puente (port a Tailwind gradual, fuera de alcance de esta migración).
// Se conserva mientras las clases legacy migran a utilidades Tailwind.
import "../styles.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-open-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PreCali — Compará créditos y seguros por país",
  description:
    "Pre-calificador financiero independiente. Compará préstamos personales, vehiculares e hipotecarios entre los principales bancos de Costa Rica usando información pública oficial.",
  keywords: [
    "préstamos Costa Rica",
    "hipoteca",
    "crédito vehicular",
    "simulador",
    "comparador bancos",
    "BAC",
    "BCR",
    "Banco Nacional",
    "Banco Popular",
    "Davivienda",
    "DaviBank",
    "pre-calificación financiera",
  ],
  authors: [{ name: "PreCali" }],
  openGraph: {
    type: "website",
    title: "PreCali — Compará préstamos de bancos en Costa Rica",
    description:
      "Encontrá el banco que realmente te conviene. Una sola simulación, todas las opciones del mercado costarricense.",
    siteName: "PreCali",
    locale: "es_CR",
  },
  twitter: {
    card: "summary_large_image",
    title: "PreCali — Compará préstamos de bancos en Costa Rica",
    description:
      "Encontrá el banco que realmente te conviene. Una sola simulación, todas las opciones del mercado costarricense.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.webp", type: "image/webp" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1F4D3F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es-CR"
      className={`${fraunces.variable} ${openSans.variable} ${plexMono.variable} ${poppins.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
