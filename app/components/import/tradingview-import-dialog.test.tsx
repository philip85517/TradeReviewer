import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradingViewImportDialog } from './tradingview-import-dialog';

afterEach(cleanup);

describe('TradingView instrument confirmation', () => {
 it('prefills Shenzhen from the filename and confirms its market', async () => {
  const onConfirm = vi.fn();
  render(<TradingViewImportDialog file={new File([], '回放交易_SZSE_300857_2026-09-13.csv')} instruments={[]} onCancel={()=>{}} onConfirm={onConfirm}/>);
  expect(screen.getByRole('combobox', {name:'证券市场'})).toHaveValue('CN-SZ');
  expect(screen.getByRole('combobox', {name:'证券代码'})).toHaveValue('300857');
  await userEvent.click(screen.getByRole('button',{name:'解析模拟交易'}));
  expect(onConfirm).toHaveBeenCalledWith({market:'CN-SZ',symbol:'300857'});
 });
 it('allows explicit market selection for renamed files', async () => {
  const onConfirm = vi.fn();
  render(<TradingViewImportDialog file={new File([], 'renamed.csv')} instruments={[]} onCancel={()=>{}} onConfirm={onConfirm}/>);
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'证券市场'}),'CN-SZ');
  await userEvent.type(screen.getByRole('combobox',{name:'证券代码'}),'300857');
  await userEvent.click(screen.getByRole('button',{name:'解析模拟交易'}));
  expect(onConfirm).toHaveBeenCalledWith({market:'CN-SZ',symbol:'300857'});
 });
});
