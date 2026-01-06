import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head' // <--- IMPORTANTE

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Fast Route | UNA Puno</title>
        <meta name="description" content="Sistema de Transporte Universitario Inteligente" />
        <link rel="icon" href="/bus.png" /> {/* Usa tu icono del bus aquí */}
      </Head>
      <Component {...pageProps} />
    </>
  )
}