module Data.Monoid.First where

import Data.Foldable (fold)
import Data.Monoid (Semigroup (..))

newtype First a = First { getFirst :: Maybe a }
  deriving (Eq, Show)

instance Semigroup (First a) where
  First Nothing <> y = y
  x <> _ = x

instance Monoid (First a) where
  mempty = First Nothing
