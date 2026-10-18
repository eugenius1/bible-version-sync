import "./shadcn.css";
import { BOOKS } from "@bvs/core";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Ban,
  Check,
  CircleAlert,
  Eye,
  Hash,
  Info,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { copyrightYears } from "../../lib/copyright";
import type { ResolvedVersion } from "../../lib/versions";
import { labHref, type Page } from "../route";
import { COLOR_HEX, SAMPLE_CHANGES, swap, useSampleMain, type Kind } from "../sample";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "./utils";

// shadcn's badges come in neutral variants only; status tones are added per use,
// which is how shadcn expects it to be extended.
const SOURCE: Record<ResolvedVersion["source"], { tone: string; Icon: typeof BadgeCheck }> = {
  verified: { tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200", Icon: BadgeCheck },
  scanned: { tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", Icon: Hash },
  "api-index": { tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", Icon: Info },
  assumed: { tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", Icon: CircleAlert },
  unsupported: { tone: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200", Icon: Ban },
};

export default function ShadcnLab({ page }: { page: Page }) {
  return <TooltipProvider>{page === "login" ? <SignIn /> : <Main />}</TooltipProvider>;
}

function Shell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  const { t, f } = useI18n();
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9" />
        <h1 className="text-lg font-semibold">Bible Version Sync</h1>
        <Badge variant="outline" className="ml-auto">
          shadcn/ui
        </Badge>
      </header>
      {children}
      <footer className="mt-auto space-y-3 pt-6 text-xs text-muted-foreground">
        <Separator />
        {account && <div className="flex flex-wrap items-center gap-1">{account}</div>}
        <p className="text-center">
          {f(t.app.copyright, { years: copyrightYears() })} ·{" "}
          <a className="underline underline-offset-2 hover:text-foreground">{t.app.licence}</a> · {t.app.notAffiliated}
        </p>
      </footer>
    </div>
  );
}

function SignIn() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="text-base leading-relaxed font-normal">{t.signIn.intro}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {t.signIn.points.map((p) => (
              <li key={p} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => {
              // Pretend: the lab never signs in, it just moves on to the main page.
              setBusy(true);
              setTimeout(() => (location.hash = labHref("shadcn", "main")), 700);
            }}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <LogIn />}
            {busy ? t.signIn.opening : t.signIn.button}
          </Button>
        </CardFooter>
      </Card>
      <p className="px-1 text-xs text-muted-foreground">{t.signIn.disclaimer}</p>
    </Shell>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {n}
    </span>
  );
}

function Main() {
  const { t, f, plural, num, book: bookName } = useI18n();
  const s = useSampleMain();
  const [remembered, setRemembered] = useState(1284);
  const running = s.run.status === "running";
  const tv = t.versions;
  const tp = t.priority;
  const ts = t.sync;

  const account = (
    <>
      <span>{plural(t.footer.memory, remembered)}</span>
      <Button variant="ghost" size="xs" onClick={() => setRemembered(0)}>
        <RotateCcw />
        {t.footer.reset}
      </Button>
      <Button variant="ghost" size="xs" className="ml-auto" asChild>
        <a href={labHref("shadcn", "login")}>
          <LogOut />
          {t.footer.signOut}
        </a>
      </Button>
    </>
  );

  return (
    <Shell account={account}>
      {/* 1. Versions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Step n={1} />
            {tv.title}
          </CardTitle>
          <CardDescription>{tv.help}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul>
            {s.versions.map((v, i) => {
              const src = tv.source[v.source];
              const { tone, Icon } = SOURCE[v.source];
              return (
                <Fragment key={v.bibleId}>
                  {i > 0 && <Separator />}
                  <li className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{v.abbr}</span>
                        <span className="truncate text-sm text-muted-foreground" lang={v.language} dir="auto">
                          {v.title}
                        </span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className={cn("border-transparent", tone)}>
                            <Icon />
                            {src.text}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>{f(src.hint, { system: tv.systems.eng, n: num(23) })}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={running || s.versions.length <= 2}
                          aria-label={f(tv.remove, { abbr: v.abbr })}
                          onClick={() => s.setVersions(s.versions.filter((x) => x.bibleId !== v.bibleId))}
                        >
                          <X />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{f(tv.remove, { abbr: v.abbr })}</TooltipContent>
                    </Tooltip>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          <Alert className="border-brand/30 bg-brand/5">
            <Sparkles />
            <AlertTitle>{tv.find.button}</AlertTitle>
            <AlertDescription>
              <p>{tv.find.help}</p>
              <Button size="sm" variant="outline" className="mt-2">
                {tv.find.button}
              </Button>
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <label htmlFor="add-version" className="text-sm font-medium">
              {tv.addLabel}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="add-version" className="pl-9" placeholder={tv.addPlaceholder} />
            </div>
            <p className="text-xs text-muted-foreground">{tv.addHelp} bible.com/bible/59</p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Priority */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Step n={2} />
            {tp.title}
          </CardTitle>
          <CardDescription>{s.byColor ? tp.helpByColor : tp.helpByVersion}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-sm font-medium">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className={cn("cursor-pointer", s.byColor && "text-muted-foreground")}
              onClick={() => s.setByColor(false)}
            >
              {tp.byVersion}
            </button>
            <Switch
              aria-label={tp.toggle}
              checked={s.byColor}
              onCheckedChange={s.setByColor}
              disabled={running}
              // Both sides are a choice, so the track stays coloured either way.
              className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-brand dark:data-[state=unchecked]:bg-brand"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className={cn("cursor-pointer", !s.byColor && "text-muted-foreground")}
              onClick={() => s.setByColor(true)}
            >
              {tp.byColor}
            </button>
          </div>
          <ol>
            {s.byColor
              ? s.colorOrder.map((id, i) => (
                  <ReorderRow
                    key={id}
                    n={i + 1}
                    count={s.colorOrder.length}
                    up={f(tp.moveUp, { color: tp.names[id] })}
                    down={f(tp.moveDown, { color: tp.names[id] })}
                    disabled={running}
                    onMove={(d) => s.setColorOrder(swap(s.colorOrder, i, d))}
                  >
                    <span className="size-6 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ background: COLOR_HEX[id] }} />
                    <span className="text-sm">{tp.names[id]}</span>
                  </ReorderRow>
                ))
              : s.versions.map((v, i) => (
                  <ReorderRow
                    key={v.bibleId}
                    n={i + 1}
                    count={s.versions.length}
                    up={f(tv.moveUp, { abbr: v.abbr })}
                    down={f(tv.moveDown, { abbr: v.abbr })}
                    disabled={running}
                    onMove={(d) => s.setVersions(swap(s.versions, i, d))}
                  >
                    <span className="font-medium">{v.abbr}</span>
                    <span className="truncate text-sm text-muted-foreground" lang={v.language} dir="auto">
                      {v.title}
                    </span>
                  </ReorderRow>
                ))}
          </ol>
          {s.byColor && <p className="text-xs text-muted-foreground">{tp.note}</p>}
        </CardContent>
      </Card>

      {/* 3. Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Step n={3} />
            {ts.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={s.kind} onValueChange={(k) => s.setKind(k as Kind)}>
            <TabsList className="w-full">
              {(["chapter", "book", "bible"] as const).map((k) => (
                <TabsTrigger key={k} value={k} disabled={running}>
                  {ts[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {s.kind !== "bible" && (
            <div className="flex gap-2">
              <Select value={s.book} onValueChange={s.setBook} disabled={running}>
                <SelectTrigger aria-label={ts.book} className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {BOOKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {bookName(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {s.kind === "chapter" && (
                <Input
                  className="w-24"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label={ts.chapter}
                  disabled={running}
                  value={s.chapter}
                  onChange={(e) => s.setChapter(Number(e.target.value))}
                />
              )}
            </div>
          )}
          {s.kind === "bible" && <p className="text-sm text-muted-foreground">{f(ts.bibleNote, { n: num(1189 * 4) })}</p>}
        </CardContent>
        <CardFooter>
          {s.run.status === "running" ? (
            <div className="w-full space-y-2" role="status">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                  {s.run.apply ? ts.syncing : ts.previewing} —{" "}
                  {f(ts.reading, { book: bookName(s.book), done: num(Math.round(s.run.pct / 5)), total: num(21) })}
                </span>
                <Button variant="ghost" size="sm" onClick={s.stop}>
                  <Square />
                  {ts.stop}
                </Button>
              </div>
              <Progress value={s.run.pct} />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button onClick={() => s.start(false)}>
                <Eye />
                {ts.preview}
              </Button>
              <Button variant="outline" onClick={() => s.start(true)}>
                <RefreshCw />
                {ts.syncNow}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {s.run.status === "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {s.run.apply ? t.results.doneTitle : t.results.previewTitle}
              <Badge variant="secondary">{plural(s.run.apply ? t.results.added : t.results.toAdd, 13)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {SAMPLE_CHANGES.map((c) => (
                <li key={c.ref} className="flex items-center gap-3 text-sm">
                  <span className="size-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: COLOR_HEX[c.color] }} />
                  <span className="w-20 font-medium">{c.ref}</span>
                  <span className="text-muted-foreground">
                    {c.from} → {c.to.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          {!s.run.apply && (
            <CardFooter className="gap-2">
              <Button onClick={() => s.start(true)}>{plural(t.results.apply, 13)}</Button>
              <Button variant="outline" onClick={s.reset}>
                {t.app.back}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </Shell>
  );
}

function ReorderRow(p: {
  n: number;
  count: number;
  up: string;
  down: string;
  disabled: boolean;
  onMove: (d: -1 | 1) => void;
  children: ReactNode;
}) {
  return (
    <>
      {p.n > 1 && <Separator />}
      <li className="flex items-center gap-3 py-1.5">
        <span className="w-5 text-right text-sm text-muted-foreground tabular-nums">{p.n}</span>
        <div className="flex min-w-0 flex-1 items-center gap-3">{p.children}</div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-label={p.up} disabled={p.disabled || p.n === 1} onClick={() => p.onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" aria-label={p.down} disabled={p.disabled || p.n === p.count} onClick={() => p.onMove(1)}>
            <ArrowDown />
          </Button>
        </div>
      </li>
    </>
  );
}
