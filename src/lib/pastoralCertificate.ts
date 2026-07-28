/**
 * Certificado de Acolhimento — PDF em paisagem, com moldura dourada.
 *
 * Gerado SOB DEMANDA a cada acesso ao link, nunca gravado em disco: em
 * serverless o arquivo escrito em public/ não sobrevive à próxima invocação, e
 * o link do certificado precisa continuar valendo meses depois.
 */

import { jsPDF } from 'jspdf'

export interface CertificateData {
  personName: string
  churchName: string
  profileLabel: string
  startedAt: Date
  finishedAt: Date
  /** etapas efetivamente cumpridas, na ordem */
  steps: Array<{ label: string; date: Date | null }>
  verse?: string
  verseRef?: string
}

const GOLD: [number, number, number] = [176, 137, 45]
const GOLD_LIGHT: [number, number, number] = [212, 175, 89]
const INK: [number, number, number] = [52, 41, 22]
const CREAM: [number, number, number] = [253, 251, 245]

function fmt(date: Date | null): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function fmtShort(date: Date | null): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/** Ornamento de canto: dois traços curtos formando um "L" com um losango. */
function cornerOrnament(doc: jsPDF, x: number, y: number, dx: number, dy: number) {
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.8)
  doc.line(x, y, x + 14 * dx, y)
  doc.line(x, y, x, y + 14 * dy)
  doc.setFillColor(...GOLD_LIGHT)
  doc.circle(x + 3.5 * dx, y + 3.5 * dy, 1.1, 'F')
}

export function buildCertificatePdf(data: CertificateData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297
  const H = 210

  // fundo cor de pergaminho
  doc.setFillColor(...CREAM)
  doc.rect(0, 0, W, H, 'F')

  // moldura: traço grosso externo + fio fino interno
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2.2)
  doc.rect(10, 10, W - 20, H - 20)
  doc.setLineWidth(0.4)
  doc.rect(14, 14, W - 28, H - 28)

  cornerOrnament(doc, 18, 18, 1, 1)
  cornerOrnament(doc, W - 18, 18, -1, 1)
  cornerOrnament(doc, 18, H - 18, 1, -1)
  cornerOrnament(doc, W - 18, H - 18, -1, -1)

  // ── cabeçalho ──
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'italic')
  doc.setFontSize(13)
  doc.text(data.churchName.toUpperCase(), W / 2, 32, { align: 'center' })

  doc.setFont('times', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...INK)
  doc.text('CERTIFICADO DE ACOLHIMENTO', W / 2, 46, { align: 'center' })

  doc.setDrawColor(...GOLD_LIGHT)
  doc.setLineWidth(0.6)
  doc.line(W / 2 - 45, 51, W / 2 + 45, 51)

  // ── nome ──
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text('Certificamos com alegria que', W / 2, 63, { align: 'center' })

  doc.setFont('times', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...GOLD)
  const name = data.personName.toUpperCase()
  doc.text(name, W / 2, 77, { align: 'center', maxWidth: W - 70 })

  doc.setDrawColor(...GOLD_LIGHT)
  doc.setLineWidth(0.3)
  doc.line(W / 2 - 70, 82, W / 2 + 70, 82)

  // ── corpo ──
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  // início e fim no mesmo dia (acompanhamento concentrado) não vira "de X a X"
  const mesmoDia = fmtShort(data.startedAt) === fmtShort(data.finishedAt)
  const periodo = mesmoDia
    ? `em ${fmt(data.finishedAt)}`
    : `no período de ${fmt(data.startedAt)} a ${fmt(data.finishedAt)}`
  const corpo =
    `concluiu o primeiro mês de acompanhamento pastoral nesta casa, ` +
    `acolhido(a) como ${data.profileLabel}, ${periodo}.`
  doc.text(corpo, W / 2, 92, { align: 'center', maxWidth: W - 80 })

  // total de contatos — o número que resume o cuidado recebido
  doc.setFont('times', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...GOLD)
  doc.text(
    `${data.steps.length} mensagem${data.steps.length === 1 ? '' : 's'} de acompanhamento enviada${data.steps.length === 1 ? '' : 's'}`,
    W / 2, 99, { align: 'center' }
  )

  // ── etapas cumpridas ──
  if (data.steps.length) {
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...GOLD)
    doc.text('JORNADA PERCORRIDA', W / 2, 110, { align: 'center' })

    doc.setFont('times', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)

    // duas colunas para caber o mês inteiro sem espremer
    const half = Math.ceil(data.steps.length / 2)
    const cols = [data.steps.slice(0, half), data.steps.slice(half)]
    cols.forEach((col, ci) => {
      const x = ci === 0 ? 42 : W / 2 + 6
      col.forEach((step, i) => {
        const y = 118 + i * 5.2
        if (y > 150) return
        doc.setFillColor(...GOLD_LIGHT)
        doc.circle(x - 3, y - 1.2, 0.8, 'F')
        doc.text(step.label, x, y, { maxWidth: W / 2 - 52 })
      })
    })
  }

  // ── versículo ──
  const verse = data.verse ?? 'Aquele que começou boa obra em vós há de completá-la.'
  const ref = data.verseRef ?? 'Filipenses 1:6'
  doc.setFont('times', 'italic')
  doc.setFontSize(11)
  doc.setTextColor(...GOLD)
  doc.text(`"${verse}"`, W / 2, 165, { align: 'center', maxWidth: W - 90 })
  doc.setFontSize(9)
  doc.text(ref, W / 2, 171, { align: 'center' })

  // ── assinatura ──
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.3)
  doc.line(W / 2 - 40, 186, W / 2 + 40, 186)
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text('Ministério Pastoral', W / 2, 191, { align: 'center' })
  doc.text(data.churchName, W / 2, 196, { align: 'center' })

  return doc.output('arraybuffer')
}
