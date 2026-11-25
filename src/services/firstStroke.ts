import type { CharacterJson } from 'hanzi-writer'

/**
 * First-stroke grading that is lenient about WHERE the stroke lands in the
 * box but just as strict about its shape as hanzi-writer's normal quiz.
 *
 * hanzi-writer's `leniency` option scales position and shape tolerance
 * together, so instead we capture the opening stroke ourselves and grade it
 * with the same algorithms hanzi-writer uses internally (Procrustes-normalized
 * Fréchet distance for shape, segment direction matching, and length ratio —
 * all position-independent), plus a centroid-aligned distance check that
 * ignores absolute placement entirely.
 */

export interface Point {
  x: number
  y: number
}

export interface FirstStrokeGrade {
  pass: boolean
  backwards: boolean
}

// --- Geometry helpers (mirroring hanzi-writer's internals) ---

const subtract = (p1: Point, p2: Point): Point => ({ x: p1.x - p2.x, y: p1.y - p2.y })
const magnitude = (p: Point): number => Math.sqrt(p.x * p.x + p.y * p.y)
const distance = (p1: Point, p2: Point): number => magnitude(subtract(p1, p2))
const equals = (p1: Point, p2: Point): boolean => p1.x === p2.x && p1.y === p2.y
const average = (values: number[]): number => values.reduce((acc, v) => acc + v, 0) / values.length
const arrLast = <T>(arr: T[]): T => arr[arr.length - 1]

const length = (points: Point[]): number => {
  let lastPoint = points[0]
  return points.slice(1).reduce((acc, point) => {
    const dist = distance(point, lastPoint)
    lastPoint = point
    return acc + dist
  }, 0)
}

const cosineSimilarity = (p1: Point, p2: Point): number =>
  (p1.x * p2.x + p1.y * p2.y) / magnitude(p1) / magnitude(p2)

const extendPointOnLine = (p1: Point, p2: Point, dist: number): Point => {
  const vect = subtract(p2, p1)
  const norm = dist / magnitude(vect)
  return { x: p2.x + norm * vect.x, y: p2.y + norm * vect.y }
}

/** based on http://www.kr.tuwien.ac.at/staff/eiter/et-archive/cdtr9464.pdf */
const frechetDist = (curve1: Point[], curve2: Point[]): number => {
  const longCurve = curve1.length >= curve2.length ? curve1 : curve2
  const shortCurve = curve1.length >= curve2.length ? curve2 : curve1

  const calcVal = (i: number, j: number, prevResultsCol: number[], curResultsCol: number[]): number => {
    if (i === 0 && j === 0) return distance(longCurve[0], shortCurve[0])
    if (i > 0 && j === 0) return Math.max(prevResultsCol[0], distance(longCurve[i], shortCurve[0]))
    const lastResult = curResultsCol[curResultsCol.length - 1]
    if (i === 0 && j > 0) return Math.max(lastResult, distance(longCurve[0], shortCurve[j]))
    return Math.max(
      Math.min(prevResultsCol[j], prevResultsCol[j - 1], lastResult),
      distance(longCurve[i], shortCurve[j]),
    )
  }

  let prevResultsCol: number[] = []
  for (let i = 0; i < longCurve.length; i++) {
    const curResultsCol: number[] = []
    for (let j = 0; j < shortCurve.length; j++) {
      curResultsCol.push(calcVal(i, j, prevResultsCol, curResultsCol))
    }
    prevResultsCol = curResultsCol
  }
  return prevResultsCol[shortCurve.length - 1]
}

const subdivideCurve = (curve: Point[], maxLen = 0.05): Point[] => {
  const newCurve = curve.slice(0, 1)
  for (const point of curve.slice(1)) {
    const prevPoint = newCurve[newCurve.length - 1]
    const segLen = distance(point, prevPoint)
    if (segLen > maxLen) {
      const numNewPoints = Math.ceil(segLen / maxLen)
      const newSegLen = segLen / numNewPoints
      for (let i = 0; i < numNewPoints; i++) {
        newCurve.push(extendPointOnLine(point, prevPoint, -1 * newSegLen * (i + 1)))
      }
    } else {
      newCurve.push(point)
    }
  }
  return newCurve
}

const outlineCurve = (curve: Point[], numPoints = 30): Point[] => {
  const curveLen = length(curve)
  const segmentLen = curveLen / (numPoints - 1)
  const outlinePoints = [curve[0]]
  const endPoint = arrLast(curve)
  const remainingCurvePoints = curve.slice(1)

  for (let i = 0; i < numPoints - 2; i++) {
    let lastPoint = arrLast(outlinePoints)
    let remainingDist = segmentLen
    let outlinePointFound = false
    while (!outlinePointFound) {
      const nextPointDist = distance(lastPoint, remainingCurvePoints[0])
      if (nextPointDist < remainingDist) {
        remainingDist -= nextPointDist
        lastPoint = remainingCurvePoints.shift() as Point
      } else {
        const nextPoint = extendPointOnLine(lastPoint, remainingCurvePoints[0], remainingDist - nextPointDist)
        outlinePoints.push(nextPoint)
        outlinePointFound = true
      }
    }
  }
  outlinePoints.push(endPoint)
  return outlinePoints
}

/** translate and scale from https://en.wikipedia.org/wiki/Procrustes_analysis */
const normalizeCurve = (curve: Point[]): Point[] => {
  const outlinedCurve = outlineCurve(curve)
  const mean = { x: average(outlinedCurve.map(p => p.x)), y: average(outlinedCurve.map(p => p.y)) }
  const translatedCurve = outlinedCurve.map(p => subtract(p, mean))
  const scale = Math.sqrt(
    average([
      translatedCurve[0].x ** 2 + translatedCurve[0].y ** 2,
      arrLast(translatedCurve).x ** 2 + arrLast(translatedCurve).y ** 2,
    ]),
  )
  const scaledCurve = translatedCurve.map(p => ({ x: p.x / scale, y: p.y / scale }))
  return subdivideCurve(scaledCurve)
}

const rotate = (curve: Point[], theta: number): Point[] =>
  curve.map(p => ({
    x: Math.cos(theta) * p.x - Math.sin(theta) * p.y,
    y: Math.sin(theta) * p.x + Math.cos(theta) * p.y,
  }))

const stripDuplicates = (points: Point[]): Point[] => {
  if (points.length < 2) return points
  const [firstPoint, ...rest] = points
  const dedupedPoints = [firstPoint]
  for (const point of rest) {
    if (!equals(point, dedupedPoints[dedupedPoints.length - 1])) dedupedPoints.push(point)
  }
  return dedupedPoints
}

// --- Matching checks (same thresholds hanzi-writer uses) ---

const COSINE_SIMILARITY_THRESHOLD = 0
const FRECHET_THRESHOLD = 0.4
const MIN_LEN_THRESHOLD = 0.35
const AVERAGE_DISTANCE_THRESHOLD = 350
const SHAPE_FIT_ROTATIONS = [Math.PI / 16, Math.PI / 32, 0, -Math.PI / 32, -Math.PI / 16]

const directionMatches = (points: Point[], strokePoints: Point[]): boolean => {
  const edgeVectors: Point[] = []
  let lastPoint = points[0]
  points.slice(1).forEach(point => {
    edgeVectors.push(subtract(point, lastPoint))
    lastPoint = point
  })
  const strokeVectors: Point[] = []
  let strokeLast = strokePoints[0]
  strokePoints.slice(1).forEach(point => {
    strokeVectors.push(subtract(point, strokeLast))
    strokeLast = point
  })
  const similarities = edgeVectors.map(edgeVector =>
    Math.max(...strokeVectors.map(strokeVector => cosineSimilarity(strokeVector, edgeVector))),
  )
  return average(similarities) > COSINE_SIMILARITY_THRESHOLD
}

const lengthMatches = (points: Point[], strokePoints: Point[], leniency: number): boolean =>
  (leniency * (length(points) + 25)) / (length(strokePoints) + 25) >= MIN_LEN_THRESHOLD

const shapeFit = (curve1: Point[], curve2: Point[], leniency: number): boolean => {
  const normCurve1 = normalizeCurve(curve1)
  const normCurve2 = normalizeCurve(curve2)
  let minDist = Infinity
  SHAPE_FIT_ROTATIONS.forEach(theta => {
    const dist = frechetDist(normCurve1, rotate(normCurve2, theta))
    if (dist < minDist) minDist = dist
  })
  return minDist <= FRECHET_THRESHOLD * leniency
}

/** Mean distance from each user point to the nearest target stroke point. */
const averageDistanceToStroke = (points: Point[], strokePoints: Point[]): number =>
  average(points.map(p => Math.min(...strokePoints.map(sp => distance(sp, p)))))

/** Translate user points so their centroid matches the target stroke's centroid. */
const alignCentroid = (points: Point[], strokePoints: Point[]): Point[] => {
  const userMean = { x: average(points.map(p => p.x)), y: average(points.map(p => p.y)) }
  const strokeMean = { x: average(strokePoints.map(p => p.x)), y: average(strokePoints.map(p => p.y)) }
  const delta = subtract(strokeMean, userMean)
  return points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y }))
}

// --- Coordinate conversion (mirrors hanzi-writer's Positioner) ---

const GRID_FROM = { x: 0, y: -124 }
const GRID_TO = { x: 1024, y: 900 }
const LOGICAL_SIZE = 600
const PADDING = 54

function toInternalPoint(point: Point): Point {
  const effective = LOGICAL_SIZE - 2 * PADDING
  const scale = Math.min(effective / (GRID_TO.x - GRID_FROM.x), effective / (GRID_TO.y - GRID_FROM.y))
  const xOffset = -GRID_FROM.x * scale + PADDING + (effective - scale * (GRID_TO.x - GRID_FROM.x)) / 2
  const yOffset = -GRID_FROM.y * scale + PADDING + (effective - scale * (GRID_TO.y - GRID_FROM.y)) / 2
  return {
    x: (point.x - xOffset) / scale,
    y: (LOGICAL_SIZE - yOffset - point.y) / scale,
  }
}

// --- Grading ---

/**
 * Grade the opening stroke with position leniency and full shape strictness.
 * `externalPoints` are in the writer's 600x600 logical coordinate space.
 * `leniency` should match the mode's normal quiz leniency so shape, direction,
 * and length requirements stay identical to later strokes.
 */
export function gradeFirstStroke(externalPoints: Point[], charData: CharacterJson, leniency: number): FirstStrokeGrade {
  const points = stripDuplicates(externalPoints.map(toInternalPoint))
  if (points.length < 2) return { pass: false, backwards: false }

  const median = (charData.medians?.[0] ?? []) as number[][]
  if (median.length < 2) return { pass: false, backwards: false }
  const strokePoints: Point[] = median.map(([x, y]) => ({ x, y }))

  const matches = (pts: Point[]): boolean => {
    const aligned = alignCentroid(pts, strokePoints)
    return (
      shapeFit(aligned, strokePoints, leniency) &&
      directionMatches(aligned, strokePoints) &&
      lengthMatches(aligned, strokePoints, leniency) &&
      averageDistanceToStroke(aligned, strokePoints) <= AVERAGE_DISTANCE_THRESHOLD * leniency
    )
  }

  if (matches(points)) return { pass: true, backwards: false }
  if (matches([...points].reverse())) return { pass: false, backwards: true }
  return { pass: false, backwards: false }
}

// --- Stroke capture ---

export interface FirstStrokeCapture {
  /** Flash the drawn ink as a mistake and clear it. */
  rejectInk(): void
  destroy(): void
}

interface CaptureOptions {
  onStrokeDrawn: (points: Point[]) => void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const DRAWING_COLOR = '#183d35'
const MISTAKE_COLOR = '#d9624c'

/**
 * Capture a single hand-drawn stroke on the writer target while hanzi-writer's
 * quiz is inactive. Points are reported in the writer's 600x600 logical space.
 */
export function captureFirstStroke(target: HTMLElement, { onStrokeDrawn }: CaptureOptions): FirstStrokeCapture {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${LOGICAL_SIZE} ${LOGICAL_SIZE}`)
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '4',
  })
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', DRAWING_COLOR)
  path.setAttribute('stroke-width', '9')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(path)
  target.appendChild(svg)

  let drawing = false
  let points: Point[] = []

  const updatePath = () => {
    path.setAttribute('d', points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '))
  }

  const toLocal = (event: PointerEvent): Point => {
    const rect = target.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * LOGICAL_SIZE) / rect.width,
      y: ((event.clientY - rect.top) * LOGICAL_SIZE) / rect.height,
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    drawing = true
    points = [toLocal(event)]
    updatePath()
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      // pointer may already be released
    }
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drawing) return
    points.push(toLocal(event))
    updatePath()
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!drawing) return
    drawing = false
    try {
      target.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    if (points.length > 1) onStrokeDrawn(points)
  }

  target.addEventListener('pointerdown', onPointerDown)
  target.addEventListener('pointermove', onPointerMove)
  target.addEventListener('pointerup', onPointerUp)
  target.addEventListener('pointercancel', onPointerUp)

  return {
    rejectInk() {
      path.setAttribute('stroke', MISTAKE_COLOR)
      window.setTimeout(() => {
        path.setAttribute('d', '')
        path.setAttribute('stroke', DRAWING_COLOR)
      }, 350)
    },
    destroy() {
      target.removeEventListener('pointerdown', onPointerDown)
      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', onPointerUp)
      target.removeEventListener('pointercancel', onPointerUp)
      svg.remove()
    },
  }
}
