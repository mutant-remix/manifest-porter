import Log75, { LogLevel } from 'log75'
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { inspect } from 'util'

export const logger = new Log75(LogLevel.Debug)

interface OrxFile {
    src: string[],
    content: string
}

const walkDir = (dir: string): string[] => {
    let files: string[] = []

    readdirSync(dir).forEach((file) => {
        const filePath = `${dir}/${file}`
        if (file.endsWith('.orx')) {
            files.push(filePath)
        } else {
            files = files.concat(walkDir(filePath))
        }
    })

    return files
}

const files: OrxFile[] = walkDir('./manifest').map((file) => {
    return {
        src: file
            .split('/')
            .slice(2) // cut off ./manifest
            .map((path, i, self) => i == self.length - 1 ? path.split('.')[0] : path), // cut off .orx
        content: readFileSync(file, 'utf-8')
    }
})

type Shortcode = (string | ('$vs16' | '$zwj') | '%u')[]
type HexColor = string

enum OrxEntryType {
    Include = 'include', // string
    Define = 'define', // OrxEntryDefine
    Emoji = 'emoji', // OrxEntryEmoji
    Palette = 'palette', // OrxEntryPalette
    Colormap = 'colormap', // OrxEntryColormap
}

type OrxEntry = [
    OrxEntryType,
    string | OrxEntryDefine | OrxEntryEmoji | OrxEntryPalette | OrxEntryColormap,
]

interface OrxEntryDefine {
    name: string,
    value: string | Shortcode | HexColor,
}

interface OrxEntryEmoji {
    short: string,
    src: string,
    code: Shortcode,
    cat: string,
    desc: string,
    color: string | undefined,
    root: string | undefined,
}

interface OrxEntryPalette {
    name: string,
    entries: {
        name: string,
        value: string | HexColor,
    }[],
}

interface OrxEntryColormap {
    name: string,
    src: string,
    dst: string,
    short: string,
    code: HexColor,
    desc: string,
}

const parseOrx = (lines: string[]): OrxEntry[] => {
    const entries: OrxEntry[] = []

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]

        // Discard everything that isnt OrxEntryType
        // TODO: Palette contents
        if (!line.match(/^(palette|include|define|emoji|colormap)/i)) continue

        // Get OrxEntryType and arguments
        const args = line.split(/[\s\t ]+/)
        const type = args.shift() as OrxEntryType

        // Parse OrxEntry
        switch (type) {
            case OrxEntryType.Include:
                entries.push([ type, args[0] ])
                break

            case OrxEntryType.Define:
                entries.push([
                    type, {
                        name: args[0],
                        value: args[1] as string | Shortcode | HexColor,
                    }
                ])
                break

            case OrxEntryType.Palette:
                // Read subsequent lines until the end or until the next palette
                const paletteLines: string[] = []

                let i = 1
                while (i < lines.length) {
                    const line = lines[lineIndex + i]
                    if (!line || line.match(/^(palette|include|define|emoji|colormap|#)/i)) break
                    paletteLines.push(line)
                    i++
                }

                // Parse palette into k = v
                const paletteEntries: { name: string, value: string | HexColor }[] = []
                for (const line of paletteLines) {
                    const [ name, value ] = line.split(/ = /).map(arg => arg.trim())
                    paletteEntries.push({ name, value })
                }

                entries.push([
                    type, {
                        name: args[0],
                        entries: paletteEntries,
                    }
                ])
                break

            case OrxEntryType.Emoji:
                type EmojiArg = [ 'short' | 'src' | 'code' | 'cat' | 'desc' | 'color' | 'root', string ]

                const emojiArgs: EmojiArg[] = args
                    .join(' ')
                    .split(/(?=\b\w+ ?= ?)/) // split right before `\w+ = `
                    .map(arg => arg.split(/ ?= ?/).map(subarg => subarg.trim()) as EmojiArg) // split into key and value

                let emoji = {
                    short: emojiArgs.find(arg => arg[0] == 'short')?.[1] ?? '',
                    src: emojiArgs.find(arg => arg[0] == 'src')?.[1] ?? '',
                    code: emojiArgs.find(arg => arg[0] == 'code')?.[1].split(' ') as Shortcode,
                    cat: emojiArgs.find(arg => arg[0] == 'cat')?.[1] ?? '',
                    desc:  emojiArgs.find(arg => arg[0] == 'desc')?.[1] ?? '',
                    color: emojiArgs.find(arg => arg[0] == 'color')?.[1],
                    root: emojiArgs.find(arg => arg[0] == 'root')?.[1],
                }

                entries.push([ type, emoji ])
                break

            case OrxEntryType.Colormap:
                type ColorMapArg = [ 'src' | 'dst' | 'short' | 'code' | 'desc', string ]

                const name = args.shift() as string
                const cmapArgs: ColorMapArg[] = args
                    .join(' ')
                    .split(/(?=\b\w+ ?= ?)/) // split right before `\w+ = `
                    .map(arg => arg.split(/ ?= ?/).map(subarg => subarg.trim()) as ColorMapArg) // split into key and value

                let colormap = {
                    name,
                    src: cmapArgs.find(arg => arg[0] == 'src')?.[1] ?? '',
                    dst: cmapArgs.find(arg => arg[0] == 'dst')?.[1] ?? '',
                    short: cmapArgs.find(arg => arg[0] == 'short')?.[1] ?? '',
                    code: cmapArgs.find(arg => arg[0] == 'code')?.[1] ?? '',
                    desc: cmapArgs.find(arg => arg[0] == 'desc')?.[1] ?? '',
                }

                entries.push([ type, colormap ])
                break
        }
    }

    return entries
}

const parseOrxFile = (file: OrxFile): string[] => {
    return file.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
}

interface ParsedOrxFile {
    src: string[],
    content: OrxEntry[]
}

const parsedOrx: ParsedOrxFile[] = files
    .map(orxFile => {
        return {
            src: orxFile.src,
            content: parseOrx(parseOrxFile(orxFile))
        }
    })

mkdirSync('out', { recursive: true })
writeFileSync('out/orx.json', JSON.stringify(parsedOrx, null, 4))
