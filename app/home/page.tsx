'use client';
import {useMemo} from 'react';
import {HomepagePreview} from '../components/homepage-preview/homepage-preview';
import {createHttpSource} from '../components/homepage-preview/http-source';
export default function Home(){const source=useMemo(()=>createHttpSource(),[]);return <HomepagePreview source={source}/>;}
