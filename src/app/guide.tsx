import { router } from 'expo-router';
import React from 'react';

import { AppScreen, Body, Card, Eyebrow, Heading, PrimaryButton } from '@/ui/components';

export default function GuideScreen() {
  return <AppScreen>
    <Eyebrow>A LITTLE HELP GETTING STARTED</Eyebrow><Heading size="large">Make this life yours</Heading>
    <Body>You can explore freely. There is no single correct life, and money is only one part of the story.</Body>
    <Card accent><Heading size="small">1. Choose what matters</Heading><Body>From age 8, Life plans gives you a direction and three concrete steps. You can change plans without losing your life or the milestones already recorded.</Body><PrimaryButton title="Explore life plans" onPress={() => router.push('/plans' as never)} /></Card>
    <Card><Heading size="small">2. Make room in your week</Heading><Body>Work, school, people, and personal projects all need time. Pick up to three priorities on the Life screen. An overloaded schedule can affect relationships, health, and performance.</Body><PrimaryButton title="See your schedule" tone="neutral" onPress={() => router.push('/time' as never)} /></Card>
    <Card><Heading size="small">3. Let life move</Heading><Body>The controls at the bottom advance one week, one month, three months, six months, or one year. Start with a week or a month. Major decisions pause a longer skip so you can respond.</Body><Body secondary>A project progresses once per in-game week. You can pause it, keep its progress, and come back when life is less busy. Its halfway choice changes the time commitment or the kind of benefit you earn.</Body></Card>
    <Card><Heading size="small">4. Follow the consequences</Heading><Body>Read “What just happened” after advancing. “Why did this happen?” explains important outcomes. Your history keeps the bigger moments, including completed projects and goals.</Body><PrimaryButton title="Open World History" tone="neutral" onPress={() => router.push('/history' as never)} /></Card>
    <Card><Heading size="small">When you feel stuck</Heading><Body>Cash is money you can spend now; net worth also includes assets and debt. A wealthy character can still be short of cash.</Body><Body>Job and school requirements matter. If an action is unavailable, use its explanation to find your next step.</Body><Body>People need different things. Keep in touch handles small catch-ups with up to five people. Conflict, trust, and major choices still need personal attention.</Body></Card>
    <Card><Heading size="small">Play comfortably</Heading><Body>Text follows your device’s text size. High contrast, reduced motion, and haptic controls are in More. Progress and decisions have text labels as well as visual cues.</Body><PrimaryButton title="Open settings" tone="neutral" onPress={() => router.push('/more' as never)} /></Card>
    <Card><Heading size="small">Your progress is yours</Heading><Body>Your life saves automatically on this device. Use Save slots to keep separate lives, export a copy, or return to a recovery checkpoint. Gameplay and projects work offline.</Body><PrimaryButton title="Open save slots" tone="neutral" onPress={() => router.push('/saves' as never)} /></Card>
  </AppScreen>;
}
