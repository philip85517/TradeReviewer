'use client';
import {useMemo} from 'react';
import {HomepagePreview} from './homepage-preview';
import {createHttpSource} from '../http-source';
export default function Home(){const source=useMemo(()=>createHttpSource(),[]);return <HomepagePreview source={source}/>;}
