export const dynamic = 'force-static'

export default function Embed() {
  return (
    <main style={{ width:'100%', height:'100vh', overflow:'hidden', background:'#fff' }}>
      <iframe
        src='/'
        style={{ width:'100%', height:'100%', border:'0' }}
        loading='eager'
      />
    </main>
  )
}
