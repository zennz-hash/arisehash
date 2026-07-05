import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://arisehash.vercel.app'
const SITE_NAME = 'AriseHash'
const DEFAULT_DESC = 'AriseHash — asisten AI untuk membuat aplikasi. Susun PRD, diagram arsitektur, dan prototipe kode langsung di browser.'

export default function SEOHead({ title, description = DEFAULT_DESC, path = '', image = '/logo.png' }) {
  const url = `${SITE_URL}${path}`
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={`${SITE_URL}${image}`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE_URL}${image}`} />
    </Helmet>
  )
}
